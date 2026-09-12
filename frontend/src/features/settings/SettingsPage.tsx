import React, { useEffect, useState } from 'react';
import {
  Store,
  Printer,
  ShieldAlert,
  Save,
  CheckCircle2,
  AlertCircle,
  FileText,
  Phone,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader/PageHeader';
import { Breadcrumb } from '../../components/common/Breadcrumb/Breadcrumb';
import { Button } from '../../components/ui/Button/Button';
import { Input } from '../../components/forms/Input/Input';
import { Select } from '../../components/forms/Select/Select';
import { Switch } from '../../components/forms/Switch/Switch';
import { LoadingState } from '../../components/common/LoadingState/LoadingState';
import { SettingsApi, CompanySettings, UpdateCompanySettingsInput } from './settings.api';
import './SettingsPage.css';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<UpdateCompanySettingsInput>({
    companyName: 'વહાણવટી ગૃહ ઉદ્યોગ',
    tagline: 'શુદ્ધ સ્વાદ અને પરંપરાગત ગુણવત્તાનું પ્રતીક',
    address: 'મુ. પાદગોલ, તા. પેટલાદ, જિ. આણંદ, ગુજરાત - ૩૮૮૪૫૦',
    phone: '+91 98250 12345',
    gstin: '24ABCDE1234F1Z5',
    fssaiLicense: '10722026000123',
    invoicePrefix: 'VGU',
    invoiceFooterNotes: 'પધારજો... આપનો આભાર! સ્વચ્છતા અને સ્વાદ અમારો ધર્મ છે.',
    printFormat: 'THERMAL_3INCH',
    allowNegativeStock: false,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const data = await SettingsApi.get();
        if (data) {
          setSettings(data);
          setFormData({
            companyName: data.companyName || 'વહાણવટી ગૃહ ઉદ્યોગ',
            tagline: data.tagline || 'શુદ્ધ સ્વાદ અને પરંપરાગત ગુણવત્તાનું પ્રતીક',
            address: data.address || '',
            phone: data.phone || '',
            gstin: data.gstin || '',
            fssaiLicense: data.fssaiLicense || '',
            invoicePrefix: data.invoicePrefix || 'VGU',
            invoiceFooterNotes: data.invoiceFooterNotes || 'પધારજો... આપનો આભાર!',
            printFormat: data.printFormat || 'THERMAL_3INCH',
            allowNegativeStock: data.allowNegativeStock ?? false,
          });
        }
      } catch (err: any) {
        console.warn('Could not load settings from server, using store defaults:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleChange = (field: keyof UpdateCompanySettingsInput, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const updated = await SettingsApi.update(formData);
      setSettings(updated);
      setSuccessMessage('Store & system configuration saved successfully!');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save configuration. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestPrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="module-shell-page">
        <LoadingState text="Loading system & store configuration..." size="lg" />
      </div>
    );
  }

  return (
    <div className="module-shell-page settings-container">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Store Settings' },
        ]}
      />

      <PageHeader
        title="Store & System Settings (સ્ટોર રૂપરેખાંકન)"
        subtitle="Manage store identity, GSTIN, 3-inch thermal receipts, invoice sequence prefixes, and inventory rules."
        actions={
          <div className="header-actions-group">
            <Button
              variant="outline"
              leftIcon={<Printer size={16} />}
              onClick={handleTestPrint}
              title="Test print current configuration on connected printer"
            >
              Test Printer
            </Button>
            <Button
              variant="primary"
              leftIcon={<Save size={16} />}
              onClick={handleSave}
              isLoading={isSaving}
            >
              Save Configuration
            </Button>
          </div>
        }
      />

      {successMessage && (
        <div className="settings-status-banner" style={{ background: '#f0fdf4', border: '1px solid #86efac', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: '#166534' }}>
          <CheckCircle2 size={18} />
          <span style={{ fontWeight: 600, fontSize: '13.5px' }}>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="settings-status-banner" style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c' }}>
          <AlertCircle size={18} />
          <span style={{ fontWeight: 600, fontSize: '13.5px' }}>{errorMessage}</span>
        </div>
      )}

      <div className="settings-grid-layout">
        {/* LEFT COLUMN: FORM SECTIONS */}
        <div className="settings-form-sections">
          {/* SECTION 1: BUSINESS PROFILE */}
          <div className="settings-card">
            <div className="settings-section-header">
              <div className="settings-section-icon">
                <Store size={20} />
              </div>
              <div>
                <h3 className="settings-section-title">Store & Business Profile (દુકાન પરિચય)</h3>
                <p className="settings-section-desc">Primary business details displayed on POS receipts and invoices.</p>
              </div>
            </div>

            <div className="settings-fields-row">
              <Input
                label="Store / Business Name (દુકાનનું નામ)"
                value={formData.companyName || ''}
                onChange={(e) => handleChange('companyName', e.target.value)}
                placeholder="વહાણવટી ગૃહ ઉદ્યોગ"
                isRequired
              />
              <Input
                label="Gujarati Tagline (સૂત્ર / ટેગલાઇન)"
                value={formData.tagline || ''}
                onChange={(e) => handleChange('tagline', e.target.value)}
                placeholder="શુદ્ધ સ્વાદ અને પરંપરાગત ગુણવત્તાનું પ્રતીક"
              />
            </div>

            <div className="settings-fields-row">
              <Input
                label="Primary Contact Phone (સંપર્ક ફોન)"
                value={formData.phone || ''}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="+91 98250 12345"
                leftIcon={<Phone size={15} />}
                isRequired
              />
              <Input
                label="GSTIN Number (જીએસટી નંબર)"
                value={formData.gstin || ''}
                onChange={(e) => handleChange('gstin', e.target.value)}
                placeholder="24ABCDE1234F1Z5"
              />
            </div>

            <div className="settings-fields-row">
              <Input
                label="FSSAI License Number (ફૂડ લાયસન્સ)"
                value={formData.fssaiLicense || ''}
                onChange={(e) => handleChange('fssaiLicense', e.target.value)}
                placeholder="10722026000123"
              />
              <div />
            </div>

            <div className="settings-full-width">
              <Input
                label="Store Address (સરનામું)"
                value={formData.address || ''}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="મુ. પાદગોલ, તા. પેટલાદ, જિ. આણંદ, ગુજરાત"
                leftIcon={<MapPin size={15} />}
                isRequired
              />
            </div>
          </div>

          {/* SECTION 2: BILLING & THERMAL PRINT CONFIGURATION */}
          <div className="settings-card">
            <div className="settings-section-header">
              <div className="settings-section-icon receipt-icon">
                <Printer size={20} />
              </div>
              <div>
                <h3 className="settings-section-title">POS Billing & Print Format (બિલિંગ અને પ્રિન્ટ)</h3>
                <p className="settings-section-desc">Invoice sequence prefix and 3-inch thermal printer configuration.</p>
              </div>
            </div>

            <div className="settings-fields-row">
              <Input
                label="Invoice Number Prefix (બિલ પ્રીફિક્સ)"
                value={formData.invoicePrefix || ''}
                onChange={(e) => handleChange('invoicePrefix', e.target.value)}
                placeholder="VGU"
                helperText="Example: VGU-20260911-0001"
                isRequired
              />
              <Select
                label="Receipt Print Format (પ્રિન્ટ સાઇઝ)"
                value={formData.printFormat || 'THERMAL_3INCH'}
                onChange={(e) => handleChange('printFormat', e.target.value)}
                options={[
                  { value: 'THERMAL_3INCH', label: '3-Inch (80mm) Thermal Roll (Default)' },
                  { value: 'THERMAL_2INCH', label: '2-Inch (58mm) Mini Thermal' },
                  { value: 'A4_STANDARD', label: 'A4 Standard Invoice Sheet' },
                ]}
              />
            </div>

            <div className="settings-full-width">
              <Input
                label="Receipt Footer Notes / Message (બિલ નીચેનો આભાર સંદેશ)"
                value={formData.invoiceFooterNotes || ''}
                onChange={(e) => handleChange('invoiceFooterNotes', e.target.value)}
                placeholder="પધારજો... આપનો આભાર!"
                helperText="Printed at the bottom of customer receipts."
              />
            </div>
          </div>

          {/* SECTION 3: INVENTORY POLICIES */}
          <div className="settings-card">
            <div className="settings-section-header">
              <div className="settings-section-icon policy-icon">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h3 className="settings-section-title">Inventory Control Policy (સ્ટોક નીતિ)</h3>
                <p className="settings-section-desc">Operational safeguards for stock management and sales terminals.</p>
              </div>
            </div>

            <div className="settings-policy-box">
              <div className="settings-policy-content">
                <div className="settings-policy-name">Allow Negative Stock (માઇનસ સ્ટોકમાં વેચાણની મંજૂરી)</div>
                <div className="settings-policy-desc">
                  When enabled, sales can be completed even if cached inventory is zero. When disabled (recommended), the POS prevents overselling beyond recorded stock levels.
                </div>
              </div>
              <Switch
                checked={formData.allowNegativeStock || false}
                onChange={(e) => handleChange('allowNegativeStock', e.target.checked)}
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE THERMAL RECEIPT PREVIEW */}
        <div className="receipt-preview-wrapper">
          <div className="settings-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', color: '#475569' }}>
              <Sparkles size={16} color="#d97706" />
              <span style={{ fontWeight: 700, fontSize: '13px' }}>Live Thermal Receipt Preview (લાઇવ રસીદ)</span>
            </div>

            <div className="receipt-mockup-paper">
              <div className="receipt-mockup-header">
                <div className="receipt-mockup-brand">{formData.companyName || 'વહાણવટી ગૃહ ઉદ્યોગ'}</div>
                {formData.tagline && <div className="receipt-mockup-tagline">{formData.tagline}</div>}
                <div className="receipt-mockup-details">
                  <div>{formData.address || 'પાદગોલ, આણંદ'}</div>
                  <div>ફોન: {formData.phone || '+91 98250 12345'}</div>
                  {formData.gstin && <div>GSTIN: {formData.gstin}</div>}
                  {formData.fssaiLicense && <div>FSSAI: {formData.fssaiLicense}</div>}
                </div>
              </div>

              <div style={{ fontSize: '11px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Bill: {formData.invoicePrefix || 'VGU'}-2026-0042</span>
                  <span>11/09/2026</span>
                </div>
                <div>ગ્રાહક: Walk-in Direct</div>
              </div>

              <div className="receipt-mockup-sample-items">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '4px' }}>
                  <span>આઇટમ</span>
                  <span>રકમ</span>
                </div>
                <div className="receipt-mockup-row">
                  <span>રતલામી સેવ (1 kg)</span>
                  <span>₹280.00</span>
                </div>
                <div className="receipt-mockup-row">
                  <span>ભાવનગરી ગાંઠિયા (500 g)</span>
                  <span>₹140.00</span>
                </div>
                <div style={{ borderTop: '1px dashed #94a3b8', margin: '6px 0' }} />
                <div className="receipt-mockup-row" style={{ fontWeight: 'bold', fontSize: '12px' }}>
                  <span>કુલ રકમ (Total):</span>
                  <span>₹420.00</span>
                </div>
                <div className="receipt-mockup-row" style={{ color: '#64748b' }}>
                  <span>Payment Mode:</span>
                  <span>CASH / રોકડ</span>
                </div>
              </div>

              <div className="receipt-mockup-footer">
                {formData.invoiceFooterNotes || 'પધારજો... આપનો આભાર!'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
