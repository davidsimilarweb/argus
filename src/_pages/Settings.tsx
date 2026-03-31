'use client';

import { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../hooks/useToast';

const PROD_URL = process.env.NEXT_PUBLIC_ARGUS_PROD_TARGET || 'https://ios-sdk-server.42matters.com';
const STAGING_URL = process.env.NEXT_PUBLIC_ARGUS_STAGING_TARGET || 'https://ios-sdk-server-staging.42matters.com';

export default function Settings() {
  const {
    availableModels,
    baseIp,
    allowedCountries,
    healthGraceMinutes,
    healthWindowHours,
    healthDecayHours,
    apiEnv,
    setAvailableModels,
    setBaseIp,
    setAllowedCountries,
    setHealthGraceMinutes,
    setHealthWindowHours,
    setHealthDecayHours,
    setApiEnv,
  } = useSettings();
  const { showToast, ToastContainer } = useToast();

  const [editingModels, setEditingModels] = useState(false);
  const [modelsText, setModelsText] = useState(availableModels.join('\n'));
  const [baseIpValue, setBaseIpValue] = useState(baseIp);
  const [editingCountries, setEditingCountries] = useState(false);
  const [countriesText, setCountriesText] = useState(allowedCountries.join('\n'));
  const [graceInput, setGraceInput] = useState(String(healthGraceMinutes));
  const [windowInput, setWindowInput] = useState(String(healthWindowHours));
  const [decayInput, setDecayInput] = useState(String(healthDecayHours));

  const handleSaveModels = () => {
    const models = modelsText
      .split('\n')
      .map(m => m.trim())
      .filter(m => m.length > 0);

    if (models.length === 0) {
      showToast('Please add at least one model', 'error');
      return;
    }

    setAvailableModels(models);
    setEditingModels(false);
    showToast('Device models saved successfully', 'success');
  };

  const handleCancelModels = () => {
    setModelsText(availableModels.join('\n'));
    setEditingModels(false);
  };

  const handleSaveCountries = () => {
    const countries = countriesText
      .split('\n')
      .map(c => c.trim().toUpperCase())
      .filter(c => c.length > 0);

    // Basic validation: 2-letter codes
    const invalid = countries.find(c => !/^[A-Z]{2}$/.test(c));
    if (invalid) {
      showToast(`Invalid country code: "${invalid}" (use 2-letter codes like "US")`, 'error');
      return;
    }

    setAllowedCountries(Array.from(new Set(countries)));
    setEditingCountries(false);
    showToast('Allowed countries saved successfully', 'success');
  };

  const handleCancelCountries = () => {
    setCountriesText(allowedCountries.join('\n'));
    setEditingCountries(false);
  };

  const handleSaveBaseIp = () => {
    const trimmed = baseIpValue.trim();
    
    // Validate: should be 1-3 octets separated by dots
    if (!trimmed) {
      showToast('Please enter a base IP prefix', 'error');
      return;
    }

    const parts = trimmed.split('.');
    if (parts.length > 3) {
      showToast('Base IP should have 1-3 octets (e.g., "192.168.0" or "192.168")', 'error');
      return;
    }

    const isValid = parts.every(part => {
      const num = parseInt(part, 10);
      return !isNaN(num) && num >= 0 && num <= 255 && part === num.toString();
    });

    if (!isValid) {
      showToast('Invalid IP format. Each octet must be 0-255', 'error');
      return;
    }

    setBaseIp(trimmed);
    showToast('Base IP saved successfully', 'success');
  };

  const handleSaveGrace = () => {
    const parsed = parseInt(graceInput, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      showToast('Grace period must be a non-negative number of minutes', 'error');
      return;
    }
    const clamped = Math.min(parsed, 240); // cap at 4 hours to avoid surprises
    setHealthGraceMinutes(clamped);
    setGraceInput(String(clamped));
    showToast('Grace period saved', 'success');
  };

  const handleSaveWindow = () => {
    const parsed = parseInt(windowInput, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      showToast('Window must be at least 1 hour', 'error');
      return;
    }
    setHealthWindowHours(parsed);
    setWindowInput(String(Math.max(1, Math.min(168, parsed))));
    showToast('Health window saved', 'success');
  };

  const handleSaveDecay = () => {
    const parsed = parseInt(decayInput, 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      showToast('Decay must be at least 1 hour', 'error');
      return;
    }
    setHealthDecayHours(parsed);
    setDecayInput(String(Math.max(1, Math.min(48, parsed))));
    showToast('Decay rate saved', 'success');
  };

  // Calculate how many octets will be entered per device
  const baseOctets = baseIp ? baseIp.split('.').length : 0;
  const remainingOctets = 4 - baseOctets;

  const handleSwitchEnv = (env: 'production' | 'staging') => {
    if (env === 'production' && apiEnv !== 'production') {
      if (!window.confirm('Switch to PRODUCTION? All changes will affect live data.')) return;
    }
    setApiEnv(env);
    showToast(`Switched to ${env}`, 'success');
  };

  return (
    <>
      <ToastContainer />
      <div className="settings">
        <h2>Settings</h2>

        {/* Environment switcher */}
        <div className="settings-section glass" style={{
          border: apiEnv === 'production'
            ? '1px solid rgba(255,85,99,0.35)'
            : '1px solid rgba(124,58,237,0.4)',
          background: apiEnv === 'production'
            ? 'rgba(255,85,99,0.06)'
            : 'rgba(124,58,237,0.08)',
        }}>
          <div className="section-header">
            <h3 style={{ color: apiEnv === 'production' ? '#ff9aa3' : '#c4a0ff' }}>
              {apiEnv === 'production' ? '🔴 Environment: Production' : '⚗️ Environment: Staging'}
            </h3>
            <p className="section-description">
              Controls which backend server all API requests are sent to. This preference is saved in your browser.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button
              onClick={() => handleSwitchEnv('production')}
              style={{
                padding: '0.6rem 1.2rem',
                border: apiEnv === 'production' ? '1px solid rgba(255,85,99,0.6)' : 'var(--border)',
                borderRadius: 'var(--radius-sm)',
                background: apiEnv === 'production' ? 'rgba(255,85,99,0.2)' : 'rgba(255,255,255,0.04)',
                color: apiEnv === 'production' ? '#ff9aa3' : 'var(--muted)',
                fontWeight: apiEnv === 'production' ? 700 : 400,
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              🔴 Production
            </button>
            <button
              onClick={() => handleSwitchEnv('staging')}
              style={{
                padding: '0.6rem 1.2rem',
                border: apiEnv === 'staging' ? '1px solid rgba(124,58,237,0.6)' : 'var(--border)',
                borderRadius: 'var(--radius-sm)',
                background: apiEnv === 'staging' ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                color: apiEnv === 'staging' ? '#c4a0ff' : 'var(--muted)',
                fontWeight: apiEnv === 'staging' ? 700 : 400,
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              ⚗️ Staging
            </button>
          </div>

          <div style={{
            fontSize: '0.82rem',
            color: 'var(--muted)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
          }}>
            <div>
              <strong style={{ color: apiEnv === 'production' ? '#ff9aa3' : 'var(--muted)' }}>Production:</strong>{' '}
              <span style={{ fontFamily: 'monospace' }}>{PROD_URL}</span>
            </div>
            <div>
              <strong style={{ color: apiEnv === 'staging' ? '#c4a0ff' : 'var(--muted)' }}>Staging:</strong>{' '}
              <span style={{ fontFamily: 'monospace' }}>{STAGING_URL}</span>
            </div>
          </div>

          {apiEnv === 'production' && (
            <div style={{
              marginTop: '1rem',
              padding: '0.65rem 0.9rem',
              background: 'rgba(255,85,99,0.12)',
              border: '1px solid rgba(255,85,99,0.3)',
              borderRadius: 'var(--radius-sm)',
              color: '#ff9aa3',
              fontSize: '0.85rem',
            }}>
              ⚠️ You are on <strong>production</strong>. Edits, deletions, and changes affect live data.
            </div>
          )}
        </div>

        <div className="settings-section glass">
          <div className="section-header">
            <h3>Base IP Address</h3>
            <p className="section-description">
              Set a base IP prefix to speed up device entry. When adding devices, you'll only need to enter the remaining octet(s).
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="baseIp">Base IP Prefix</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                id="baseIp"
                type="text"
                className="form-input"
                value={baseIpValue}
                onChange={(e) => setBaseIpValue(e.target.value)}
                placeholder="192.168.0"
                style={{ flex: 1 }}
              />
              <button className="btn-primary" onClick={handleSaveBaseIp}>
                Save
              </button>
            </div>
            <small style={{ color: 'rgba(255,255,255,0.6)', marginTop: '4px', display: 'block' }}>
              Enter 1-3 octets. Examples: "192.168.0" (enter last 1), "192.168" (enter last 2), "192" (enter last 3)
            </small>
          </div>

          <div style={{ 
            marginTop: '1rem', 
            padding: '1rem', 
            background: 'rgba(0,255,159,0.1)', 
            border: '1px solid rgba(0,255,159,0.3)', 
            borderRadius: 'var(--radius-sm)' 
          }}>
            <div style={{ color: 'var(--accent)', fontWeight: 600, marginBottom: '0.5rem' }}>Current Configuration</div>
            <div className="device-meta">
              <strong>Base prefix:</strong>&nbsp;{baseIp || '(not set)'}
            </div>
            <div className="device-meta">
              <strong>You'll enter:</strong>&nbsp;
              {remainingOctets === 1 && 'Last octet only (e.g., "100" → ' + baseIp + '.100)'}
              {remainingOctets === 2 && 'Last 2 octets (e.g., "0.100" → ' + baseIp + '.0.100)'}
              {remainingOctets === 3 && 'Last 3 octets (e.g., "168.0.100" → ' + baseIp + '.168.0.100)'}
              {remainingOctets === 4 && 'Full IP address (no base prefix set)'}
            </div>
          </div>
        </div>

        <div className="settings-section glass">
          <div className="section-header">
            <h3>Healthcheck Grace Period</h3>
            <p className="section-description">
              Ignore the most recent failure if it occurred within this window, and instead count the previous healthcheck for the device.
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="graceMinutes">Grace period (minutes)</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                id="graceMinutes"
                type="number"
                min={0}
                max={240}
                step={1}
                className="form-input"
                value={graceInput}
                onChange={(e) => setGraceInput(e.target.value)}
                style={{ maxWidth: '200px' }}
              />
              <button className="btn-primary" onClick={handleSaveGrace}>
                Save
              </button>
            </div>
            <small style={{ color: 'rgba(255,255,255,0.6)', marginTop: '4px', display: 'block' }}>
              Recent failures newer than this window are ignored for dashboard counts. Default: 20 minutes.
            </small>
          </div>
        </div>

        <div className="settings-section glass">
          <div className="section-header">
            <h3>System Health</h3>
            <p className="section-description">
              Configure the System Health page scoring parameters.
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="windowHours">History window (hours)</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                id="windowHours"
                type="number"
                min={1}
                max={168}
                step={1}
                className="form-input"
                value={windowInput}
                onChange={(e) => setWindowInput(e.target.value)}
                style={{ maxWidth: '120px' }}
              />
              <button className="btn-primary" onClick={handleSaveWindow}>Save</button>
              {([6, 12, 24, 48, 168] as const).map((h) => (
                <button
                  key={h}
                  className="btn-secondary"
                  style={{ padding: '0.35rem 0.7rem', fontSize: '0.85rem' }}
                  onClick={() => { setHealthWindowHours(h); setWindowInput(String(h)); showToast(`Window set to ${h < 168 ? `${h}h` : '7d'}`, 'success'); }}
                >
                  {h < 168 ? `${h}h` : '7d'}
                </button>
              ))}
            </div>
            <small style={{ color: 'rgba(255,255,255,0.6)', marginTop: '4px', display: 'block' }}>
              How far back to fetch crawler logs for the System Health page. Default: 24 hours.
            </small>
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label htmlFor="decayHours">Score decay rate (hours)</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                id="decayHours"
                type="number"
                min={1}
                max={48}
                step={1}
                className="form-input"
                value={decayInput}
                onChange={(e) => setDecayInput(e.target.value)}
                style={{ maxWidth: '120px' }}
              />
              <button className="btn-primary" onClick={handleSaveDecay}>Save</button>
              {([3, 6, 12, 24] as const).map((h) => (
                <button
                  key={h}
                  className="btn-secondary"
                  style={{ padding: '0.35rem 0.7rem', fontSize: '0.85rem' }}
                  onClick={() => { setHealthDecayHours(h); setDecayInput(String(h)); showToast(`Decay set to ${h}h`, 'success'); }}
                >
                  {h}h
                </button>
              ))}
            </div>
            <small style={{ color: 'rgba(255,255,255,0.6)', marginTop: '4px', display: 'block' }}>
              Controls how fast old checks lose importance. Lower = very recent-focused. Higher = smooth long-term view. Default: 12 hours.
            </small>
          </div>
        </div>

        <div className="settings-section glass">
          <div className="section-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3>Allowed Countries</h3>
                <p className="section-description">
                  Configure the list of country codes available in the Accounts country dropdown (one per line).
                </p>
              </div>
              {!editingCountries && (
                <button className="btn-secondary" onClick={() => setEditingCountries(true)}>
                  Edit Countries
                </button>
              )}
            </div>
          </div>

          {editingCountries ? (
            <div className="form-group">
              <label htmlFor="countries">Allowed Countries (ISO 3166-1 alpha-2, one per line)</label>
              <textarea
                id="countries"
                className="form-input"
                value={countriesText}
                onChange={(e) => setCountriesText(e.target.value)}
                rows={10}
                placeholder="US&#10;GB&#10;DE"
                style={{ fontFamily: 'monospace', fontSize: '13px' }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button className="btn-primary" onClick={handleSaveCountries}>
                  Save Countries
                </button>
                <button className="btn-secondary" onClick={handleCancelCountries}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="models-list">
              {allowedCountries.map((c, idx) => (
                <div key={idx} className="model-item">
                  <span className="model-bullet">•</span>
                  <span>{c}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="settings-section glass">
          <div className="section-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3>Available Device Models</h3>
                <p className="section-description">
                  Configure the list of device models shown in the dropdown when creating or editing devices.
                </p>
              </div>
              {!editingModels && (
                <button className="btn-secondary" onClick={() => setEditingModels(true)}>
                  Edit Models
                </button>
              )}
            </div>
          </div>

          {editingModels ? (
            <div className="form-group">
              <label htmlFor="models">Device Models (one per line)</label>
              <textarea
                id="models"
                className="form-input"
                value={modelsText}
                onChange={(e) => setModelsText(e.target.value)}
                rows={15}
                placeholder="iPhone 11&#10;iPhone 12&#10;iPhone 13"
                style={{ fontFamily: 'monospace', fontSize: '13px' }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button className="btn-primary" onClick={handleSaveModels}>
                  Save Models
                </button>
                <button className="btn-secondary" onClick={handleCancelModels}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="models-list">
              {availableModels.map((model, idx) => (
                <div key={idx} className="model-item">
                  <span className="model-bullet">•</span>
                  <span>{model}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="settings-section glass">
          <div className="section-header">
            <h3>API Information</h3>
            <p className="section-description">Current API configuration details.</p>
          </div>
          <div className="device-meta"><strong>Active target:</strong>&nbsp;<span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{apiEnv === 'staging' ? STAGING_URL : PROD_URL}</span></div>
          <div className="device-meta"><strong>Authentication:</strong>&nbsp;X-Token header (server-side, never exposed to browser)</div>
          <div className="device-meta"><strong>Proxy:</strong>&nbsp;/api/argus → backend, /api/internal → backend</div>
        </div>
      </div>
    </>
  );
}
