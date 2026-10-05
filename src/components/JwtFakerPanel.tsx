import { useState, useEffect } from 'react';
import {
  generateJwt,
  decodeJwt,
  getClaimTimestamp,
} from '../utils/jwtUtils';
import type { JwtAlgorithm, JwtTemplate } from '../utils/types';
import { Copy, Check, Sparkles, X } from 'lucide-react';

interface JwtFakerPanelProps {
  showToast?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
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

export const JwtFakerPanel = ({ showToast }: JwtFakerPanelProps) => {
  const [algorithm, setAlgorithm] = useState<JwtAlgorithm>('HS256');
  const [secret, setSecret] = useState('your-256-bit-secret');
  const [headerJson, setHeaderJson] = useState(DEFAULT_HEADER);
  const [payloadJson, setPayloadJson] = useState(DEFAULT_PAYLOAD);
  const [generatedJwt, setGeneratedJwt] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'decoder' | 'templates'>('editor');
  const [inputTokenToDecode, setInputTokenToDecode] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  // Saved templates
  const [templates, setTemplates] = useState<JwtTemplate[]>(() => {
    try {
      const saved = localStorage.getItem('__voiden_jwt_templates__');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [templateName, setTemplateName] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem('__voiden_jwt_templates__', JSON.stringify(templates));
    } catch {
      // Ignore storage errors
    }
  }, [templates]);

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

  const handleCopy = () => {
    if (!generatedJwt) return;
    navigator.clipboard.writeText(generatedJwt);
    setCopied(true);
    showToast?.('JWT copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
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

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;
    const newTemplate: JwtTemplate = {
      id: Date.now().toString(),
      name: templateName.trim(),
      algorithm,
      secret,
      header: headerJson,
      payload: payloadJson,
    };
    setTemplates([...templates, newTemplate]);
    setTemplateName('');
    showToast?.(`Saved template "${newTemplate.name}"`, 'success');
  };

  const handleLoadTemplate = (tpl: JwtTemplate) => {
    setAlgorithm(tpl.algorithm);
    setSecret(tpl.secret);
    setHeaderJson(tpl.header);
    setPayloadJson(tpl.payload);
    setActiveTab('editor');
    showToast?.(`Loaded template "${tpl.name}"`, 'info');
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates(templates.filter((t) => t.id !== id));
  };

  const decoded = decodeJwt(activeTab === 'decoder' ? inputTokenToDecode || generatedJwt : generatedJwt);

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
          <button
            className={tabButtonClass('decoder')}
            onClick={() => {
              setActiveTab('decoder');
              if (!inputTokenToDecode) setInputTokenToDecode(generatedJwt);
            }}
          >
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
                  <button onClick={handleCopy} disabled={!generatedJwt} className={primaryButtonClass}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied!' : 'Copy JWT'}
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={3}
                  value={generatedJwt}
                  className={`${codeBaseClass} text-accent select-all`}
                />
              </div>

              {/* Save Template Bar */}
              <div className="flex items-center gap-2 pt-3 border-t border-border">
                <input
                  type="text"
                  placeholder="Template name (e.g. Admin Token)"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className={inputClass}
                />
                <button onClick={handleSaveTemplate} disabled={!templateName.trim()} className={`${secondaryButtonClass} whitespace-nowrap`}>
                  Save as Template
                </button>
              </div>
            </>
          )}

          {activeTab === 'decoder' && (
            <div className="space-y-4">
              <div>
                <label className={labelClass}>JWT Token to Decode</label>
                <textarea
                  rows={3}
                  value={inputTokenToDecode}
                  onChange={(e) => setInputTokenToDecode(e.target.value)}
                  placeholder="Paste JWT token here..."
                  className={`${codeClass} placeholder:text-comment`}
                />
              </div>

              {decoded.isValid ? (
                <div className="flex gap-4">
                  <div className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold text-comment mb-1">Decoded Header</span>
                    <pre className="font-mono text-xs bg-panel border border-border rounded p-2 overflow-x-auto text-text">
                      {JSON.stringify(decoded.header, null, 2)}
                    </pre>
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold text-comment mb-1">Decoded Payload</span>
                    <pre className="font-mono text-xs bg-panel border border-border rounded p-2 overflow-x-auto text-text">
                      {JSON.stringify(decoded.payload, null, 2)}
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
              {templates.length === 0 ? (
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
                      <div className="text-xs font-semibold text-text">{tpl.name}</div>
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
