import { useState, useEffect } from 'react';
import {
  generateJwt,
  decodeJwt,
  getClaimTimestamp,
} from '../utils/jwtUtils';
import type { JwtAlgorithm, JwtTemplate } from '../utils/types';
import { TEMPLATES_FILE, type TemplateStore } from '../utils/templateStore';
import { Copy, Check, Sparkles, X } from 'lucide-react';

type ShowToast = (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;

interface JwtFakerPanelProps {
  templateStore: TemplateStore;
  showToast?: ShowToast;
}

const DEFAULT_HEADER = JSON.stringify({ alg: 'HS256', typ: 'JWT' }, null, 2);
const DEFAULT_PAYLOAD = JSON.stringify(
  {
    sub: '123456789',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  },
  null,
  2
);

// Voiden only ships CSS for Tailwind classes its own UI uses, so every class
// below is an existing Voiden theme class — they also follow the active theme.
const labelClass = 'block text-xs font-medium text-comment mb-1';
const inputClass =
  'w-full bg-panel border border-border rounded px-3 py-1.5 text-xs text-text placeholder:text-comment focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed';
const codeBaseClass =
  'w-full font-mono text-xs bg-panel border border-border rounded p-2 focus:outline-none focus:ring-1 focus:ring-accent';
const codeClass = `${codeBaseClass} text-text`;
const secondaryButtonClass =
  'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border bg-panel hover:bg-active text-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const primaryButtonClass =
  'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-button-primary hover:bg-button-primary-hover text-bg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const errorClass = 'rounded border border-border bg-panel px-3 py-2 text-xs text-status-error';

interface CopyButtonProps {
  text: string;
  label: string;
  copied: boolean;
  onCopy: () => void;
  primary?: boolean;
}

/** Copy button with a short "Copied" confirmation state. */
const CopyButton = ({ text, label, copied, onCopy, primary }: CopyButtonProps) => (
  <button
    onClick={onCopy}
    disabled={!text}
    title={copied ? 'Copied to clipboard' : `Copy ${label.toLowerCase()} to clipboard`}
    className={primary ? primaryButtonClass : secondaryButtonClass}
  >
    {copied ? <Check size={14} /> : <Copy size={14} />}
    {copied ? 'Copied' : `Copy ${label}`}
  </button>
);

export const JwtFakerPanel = ({ templateStore, showToast }: JwtFakerPanelProps) => {
  const [algorithm, setAlgorithm] = useState<JwtAlgorithm>('HS256');
  const [secret, setSecret] = useState('your-256-bit-secret');
  const [headerJson, setHeaderJson] = useState(DEFAULT_HEADER);
  const [payloadJson, setPayloadJson] = useState(DEFAULT_PAYLOAD);
  const [generatedJwt, setGeneratedJwt] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'decoder' | 'templates'>('editor');
  const [inputTokenToDecode, setInputTokenToDecode] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  // Saved templates, stored per project in .voiden/jwt-templates.json
  const [templates, setTemplates] = useState<JwtTemplate[]>([]);
  const [templatesStatus, setTemplatesStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  // The template currently loaded into the generator, so edits can update it.
  const [loadedTemplateId, setLoadedTemplateId] = useState<string | null>(null);

  useEffect(() => {
    let isSubscribed = true;
    templateStore
      .load()
      .then((loaded) => {
        if (!isSubscribed) return;
        setTemplates(loaded);
        setTemplatesStatus('ready');
      })
      .catch((err) => {
        if (!isSubscribed) return;
        // Leave the file untouched: saving stays disabled until it can be read.
        setTemplatesError(err instanceof Error ? err.message : String(err));
        setTemplatesStatus('error');
      });
    return () => {
      isSubscribed = false;
    };
  }, [templateStore]);

  const persistTemplates = (next: JwtTemplate[]) => {
    setTemplates(next);
    templateStore.save(next).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      showToast?.(`Could not save templates to ${TEMPLATES_FILE}: ${msg}`, 'error');
    });
  };
  const canSaveTemplates = templatesStatus === 'ready';

  // Re-generate JWT whenever inputs change
  useEffect(() => {
    let isSubscribed = true;
    const generate = async () => {
      try {
        setParseError(null);
        let headerObj = {};
        let payloadObj = {};

        try {
          headerObj = JSON.parse(headerJson);
        } catch {
          setParseError('Invalid JSON in Header');
          return;
        }

        try {
          payloadObj = JSON.parse(payloadJson);
        } catch {
          setParseError('Invalid JSON in Payload');
          return;
        }

        const token = await generateJwt(headerObj, payloadObj, secret, algorithm);
        if (isSubscribed) {
          setGeneratedJwt(token);
        }
      } catch (err) {
        if (isSubscribed) {
          const msg = err instanceof Error ? err.message : String(err);
          setParseError(msg);
        }
      }
    };

    generate();
    return () => {
      isSubscribed = false;
    };
  }, [algorithm, secret, headerJson, payloadJson]);

  const copyToClipboard = async (key: string, text: string, label: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      showToast?.(`${label} copied to clipboard`, 'success');
      setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 2000);
    } catch {
      showToast?.(`Could not copy ${label.toLowerCase()} to clipboard`, 'error');
    }
  };

  const handleAddClaim = (claimName: string, value: any) => {
    try {
      const current = JSON.parse(payloadJson || '{}');
      current[claimName] = value;
      setPayloadJson(JSON.stringify(current, null, 2));
    } catch {
      // Ignore parse error
    }
  };

  const loadedTemplate = templates.find((t) => t.id === loadedTemplateId) ?? null;
  const hasTemplateChanges =
    !!loadedTemplate &&
    (loadedTemplate.name !== templateName.trim() ||
      loadedTemplate.algorithm !== algorithm ||
      loadedTemplate.secret !== secret ||
      loadedTemplate.header !== headerJson ||
      loadedTemplate.payload !== payloadJson);

  const handleSaveTemplate = () => {
    if (!canSaveTemplates || !templateName.trim()) return;
    const newTemplate: JwtTemplate = {
      id: Date.now().toString(),
      name: templateName.trim(),
      algorithm,
      secret,
      header: headerJson,
      payload: payloadJson,
    };
    persistTemplates([...templates, newTemplate]);
    // Keep the new template loaded so further edits update it.
    setLoadedTemplateId(newTemplate.id);
    setTemplateName(newTemplate.name);
    showToast?.(`Saved template "${newTemplate.name}"`, 'success');
  };

  const handleUpdateTemplate = () => {
    if (!canSaveTemplates || !loadedTemplate || !templateName.trim()) return;
    const updated: JwtTemplate = {
      ...loadedTemplate,
      name: templateName.trim(),
      algorithm,
      secret,
      header: headerJson,
      payload: payloadJson,
    };
    persistTemplates(templates.map((t) => (t.id === updated.id ? updated : t)));
    setTemplateName(updated.name);
    showToast?.(`Updated template "${updated.name}"`, 'success');
  };

  const handleDetachTemplate = () => {
    setLoadedTemplateId(null);
    setTemplateName('');
  };

  const handleLoadTemplate = (tpl: JwtTemplate) => {
    setAlgorithm(tpl.algorithm);
    setSecret(tpl.secret);
    setHeaderJson(tpl.header);
    setPayloadJson(tpl.payload);
    setLoadedTemplateId(tpl.id);
    setTemplateName(tpl.name);
    setActiveTab('editor');
    showToast?.(`Loaded template "${tpl.name}"`, 'info');
  };

  const handleDeleteTemplate = (id: string) => {
    persistTemplates(templates.filter((t) => t.id !== id));
    if (id === loadedTemplateId) handleDetachTemplate();
  };

  const tokenToDecode = inputTokenToDecode.trim();
  const decoded = tokenToDecode ? decodeJwt(tokenToDecode) : null;
  const decodedHeaderJson = decoded?.isValid ? JSON.stringify(decoded.header, null, 2) : '';
  const decodedPayloadJson = decoded?.isValid ? JSON.stringify(decoded.payload, null, 2) : '';

  const tabButtonClass = (tab: typeof activeTab) =>
    `px-3 py-1 transition-colors ${
      activeTab === tab ? 'bg-active text-text font-medium' : 'text-comment hover:text-text hover:bg-hover'
    }`;

  return (
    <div className="h-full flex flex-col bg-editor text-text overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-4 py-2 border-b border-border bg-panel">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold">JWT Faker & Generator</h2>
        </div>

        {/* Tabs */}
        <div className="flex border border-border rounded-md overflow-hidden text-xs">
          <button className={tabButtonClass('editor')} onClick={() => setActiveTab('editor')}>
            Generator
          </button>
          <button className={tabButtonClass('decoder')} onClick={() => setActiveTab('decoder')}>
            Decoder
          </button>
          <button className={tabButtonClass('templates')} onClick={() => setActiveTab('templates')}>
            Templates ({templates.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 space-y-4">
          {activeTab === 'editor' && (
            <>
              {/* Algorithm & Secret */}
              <div className="flex gap-4">
                <div className="flex-1 min-w-0">
                  <label className={labelClass}>Algorithm</label>
                  <select
                    value={algorithm}
                    onChange={(e) => setAlgorithm(e.target.value as JwtAlgorithm)}
                    className={inputClass}
                  >
                    <option value="HS256">HS256 (HMAC SHA-256)</option>
                    <option value="HS384">HS384 (HMAC SHA-384)</option>
                    <option value="HS512">HS512 (HMAC SHA-512)</option>
                    <option value="none">none (Unsigned Token)</option>
                  </select>
                </div>

                <div className="flex-1 min-w-0">
                  <label className={labelClass}>
                    Secret Key {algorithm === 'none' && '(Not required for unsigned)'}
                  </label>
                  <input
                    type="text"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    disabled={algorithm === 'none'}
                    placeholder="Enter signing secret"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Payload Claim Quick Buttons */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-comment font-medium">Quick Claims:</span>
                <button onClick={() => handleAddClaim('exp', getClaimTimestamp(3600))} className={secondaryButtonClass}>
                  +1h Exp
                </button>
                <button onClick={() => handleAddClaim('exp', getClaimTimestamp(86400))} className={secondaryButtonClass}>
                  +1d Exp
                </button>
                <button onClick={() => handleAddClaim('iat', getClaimTimestamp(0))} className={secondaryButtonClass}>
                  Set iat Now
                </button>
                <button onClick={() => handleAddClaim('nbf', getClaimTimestamp(0))} className={secondaryButtonClass}>
                  Set nbf Now
                </button>
              </div>

              {/* JSON Editors */}
              <div className="flex gap-4">
                <div className="flex-1 min-w-0">
                  <label className={labelClass}>Header (JSON)</label>
                  <textarea
                    rows={6}
                    value={headerJson}
                    onChange={(e) => setHeaderJson(e.target.value)}
                    className={codeClass}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <label className={labelClass}>Payload (JSON)</label>
                  <textarea
                    rows={6}
                    value={payloadJson}
                    onChange={(e) => setPayloadJson(e.target.value)}
                    className={codeClass}
                  />
                </div>
              </div>

              {/* Parse Error */}
              {parseError && <div className={errorClass}>{parseError}</div>}

              {/* Encoded Token Result */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-text">Generated Encoded JWT</label>
                  <CopyButton
                    text={generatedJwt}
                    label="JWT"
                    primary
                    copied={copiedKey === 'jwt'}
                    onCopy={() => copyToClipboard('jwt', generatedJwt, 'JWT')}
                  />
                </div>
                <textarea
                  readOnly
                  rows={3}
                  value={generatedJwt}
                  onFocus={(e) => e.target.select()}
                  className={`${codeBaseClass} text-accent`}
                />
              </div>

              {/* Save / Update Template Bar */}
              <div className="pt-3 border-t border-border space-y-2">
                {loadedTemplate && (
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-comment">
                      Editing template <span className="font-semibold text-text">{loadedTemplate.name}</span>
                      {hasTemplateChanges && <span className="text-accent"> · Unsaved changes</span>}
                    </span>
                    <button
                      onClick={handleDetachTemplate}
                      className="text-comment hover:text-text transition-colors"
                      title="Stop editing this template"
                    >
                      Stop editing
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Template name (e.g. Admin Token)"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className={inputClass}
                  />
                  {loadedTemplate ? (
                    <>
                      <button
                        onClick={handleUpdateTemplate}
                        disabled={!canSaveTemplates || !hasTemplateChanges || !templateName.trim()}
                        className={`${primaryButtonClass} whitespace-nowrap`}
                      >
                        Update Template
                      </button>
                      <button
                        onClick={handleSaveTemplate}
                        disabled={!canSaveTemplates || !templateName.trim()}
                        className={`${secondaryButtonClass} whitespace-nowrap`}
                      >
                        Save as New
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleSaveTemplate}
                      disabled={!canSaveTemplates || !templateName.trim()}
                      className={`${secondaryButtonClass} whitespace-nowrap`}
                    >
                      Save as Template
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'decoder' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-comment">JWT Token to Decode</label>
                  <div className="flex items-center gap-2">
                    {generatedJwt && (
                      <button onClick={() => setInputTokenToDecode(generatedJwt)} className={secondaryButtonClass}>
                        Use Generated JWT
                      </button>
                    )}
                    {inputTokenToDecode && (
                      <button onClick={() => setInputTokenToDecode('')} className={secondaryButtonClass}>
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  rows={3}
                  value={inputTokenToDecode}
                  onChange={(e) => setInputTokenToDecode(e.target.value)}
                  placeholder="Paste a JWT here to decode its header and payload..."
                  className={`${codeClass} placeholder:text-comment`}
                />
              </div>

              {!decoded ? (
                <div className="text-xs text-comment text-center py-6">
                  Paste a JWT above to see its decoded header and payload.
                </div>
              ) : decoded.isValid ? (
                <div className="flex gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-comment">Decoded Header</span>
                      <CopyButton
                        text={decodedHeaderJson}
                        label="Header"
                        copied={copiedKey === 'header'}
                        onCopy={() => copyToClipboard('header', decodedHeaderJson, 'Header')}
                      />
                    </div>
                    <pre className="font-mono text-xs bg-panel border border-border rounded p-2 overflow-x-auto text-text">
                      {decodedHeaderJson}
                    </pre>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-comment">Decoded Payload</span>
                      <CopyButton
                        text={decodedPayloadJson}
                        label="Payload"
                        copied={copiedKey === 'payload'}
                        onCopy={() => copyToClipboard('payload', decodedPayloadJson, 'Payload')}
                      />
                    </div>
                    <pre className="font-mono text-xs bg-panel border border-border rounded p-2 overflow-x-auto text-text">
                      {decodedPayloadJson}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className={errorClass}>{decoded.error || 'Invalid token structure'}</div>
              )}
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-2">
              <div className="text-[11px] text-comment">
                Saved in <span className="font-mono">{TEMPLATES_FILE}</span> for this project. Voiden keeps{' '}
                <span className="font-mono">.voiden/</span> out of git, so secrets stay on this machine.
              </div>
              {templatesStatus === 'loading' ? (
                <div className="text-xs text-comment text-center py-6">Loading templates…</div>
              ) : templatesStatus === 'error' ? (
                <div className={errorClass}>
                  Could not read {TEMPLATES_FILE}: {templatesError}. Fix or remove the file, then reopen this tab.
                  Saving templates is disabled so the file isn't overwritten.
                </div>
              ) : templates.length === 0 ? (
                <div className="text-xs text-comment text-center py-6">
                  No saved templates yet. Customize claims in the Generator and click "Save as Template".
                </div>
              ) : (
                templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="flex items-center justify-between p-2.5 border border-border rounded bg-panel hover:bg-active transition-colors"
                  >
                    <div>
                      <div className="text-xs font-semibold text-text">
                        {tpl.name}
                        {tpl.id === loadedTemplateId && <span className="font-normal text-accent"> · Loaded</span>}
                      </div>
                      <div className="text-[11px] text-comment">
                        Alg: {tpl.algorithm} | Key: {tpl.secret || '(none)'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleLoadTemplate(tpl)} className={primaryButtonClass}>
                        Load
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(tpl.id)}
                        className="p-1 rounded text-comment hover:text-text transition-colors"
                        title="Delete template"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
