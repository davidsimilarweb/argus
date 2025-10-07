import { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../hooks/useToast';

export default function Settings() {
  const { availableModels, baseIp, setAvailableModels, setBaseIp } = useSettings();
  const { showToast, ToastContainer } = useToast();

  const [editingModels, setEditingModels] = useState(false);
  const [modelsText, setModelsText] = useState(availableModels.join('\n'));
  const [ipValue, setIpValue] = useState(baseIp);

  const handleSaveModels = async () => {
    const models = modelsText
      .split('\n')
      .map(m => m.trim())
      .filter(m => m.length > 0);

    if (models.length === 0) {
      showToast('Please add at least one model', 'error');
      return;
    }

    try {
      await setAvailableModels(models);
      setEditingModels(false);
      showToast('Device models saved successfully', 'success');
    } catch (error) {
      showToast('Failed to save device models', 'error');
    }
  };

  const handleSaveBaseIp = async () => {
    // Validate IP format (basic validation for first 3 octets)
    const ipParts = ipValue.split('.');
    if (ipParts.length !== 3) {
      showToast('Base IP should have 3 octets (e.g., 192.168.0)', 'error');
      return;
    }

    const isValid = ipParts.every(part => {
      const num = parseInt(part, 10);
      return !isNaN(num) && num >= 0 && num <= 255;
    });

    if (!isValid) {
      showToast('Invalid IP format. Each octet must be 0-255', 'error');
      return;
    }

    try {
      await setBaseIp(ipValue);
      showToast('Base IP saved successfully', 'success');
    } catch (error) {
      showToast('Failed to save base IP', 'error');
    }
  };

  const handleCancelModels = () => {
    setModelsText(availableModels.join('\n'));
    setEditingModels(false);
  };

  return (
    <>
      <ToastContainer />
      <div className="settings">
        <h2>Settings</h2>

        <div className="settings-section glass">
          <div className="section-header">
            <h3>Base IP Address</h3>
            <p className="section-description">
              Configure the first 3 octets of device IP addresses (e.g., 192.168.0).
              When creating devices, only the last octet will need to be entered.
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="baseIp">Base IP (First 3 Octets)</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                id="baseIp"
                type="text"
                className="form-input"
                value={ipValue}
                onChange={(e) => setIpValue(e.target.value)}
                placeholder="192.168.0"
                style={{ flex: 1 }}
              />
              <button className="btn-primary" onClick={handleSaveBaseIp}>
                Save
              </button>
            </div>
            <small style={{ color: 'rgba(255,255,255,0.6)', marginTop: '4px', display: 'block' }}>
              Example: 192.168.0 → Full IP will be 192.168.0.X
            </small>
          </div>
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
      </div>
    </>
  );
}
