import { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../hooks/useToast';

export default function Settings() {
  const { availableModels, baseIp, allowedCountries, setAvailableModels, setBaseIp, setAllowedCountries } = useSettings();
  const { showToast, ToastContainer } = useToast();

  const [editingModels, setEditingModels] = useState(false);
  const [modelsText, setModelsText] = useState(availableModels.join('\n'));
  const [baseIpValue, setBaseIpValue] = useState(baseIp);
  const [editingCountries, setEditingCountries] = useState(false);
  const [countriesText, setCountriesText] = useState(allowedCountries.join('\n'));

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

  // Calculate how many octets will be entered per device
  const baseOctets = baseIp ? baseIp.split('.').length : 0;
  const remainingOctets = 4 - baseOctets;

  return (
    <>
      <ToastContainer />
      <div className="settings">
        <h2>Settings</h2>

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
            <p className="section-description">
              Current API configuration details.
            </p>
          </div>
          <div className="device-meta"><strong>API Endpoint:</strong>&nbsp;/argus (proxied to ios-sdk-server-staging.42matters.com)</div>
          <div className="device-meta"><strong>Authentication:</strong>&nbsp;X-Token header</div>
          <div className="device-meta"><strong>Token Source:</strong>&nbsp;`VITE_ARGUS_TOKEN` from `.env`</div>
        </div>
      </div>
    </>
  );
}
