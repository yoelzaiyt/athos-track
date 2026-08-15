import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { homologationRequestToInsertRow } from '../../lib/mappers';
import {
  HomologationRequest,
  HomologationProtocol,
  HomologationTransport,
} from '../../types/homologation';

type FormState = Omit<HomologationRequest, 'id' | 'sessionToken' | 'createdAt' | 'status' | 'adminNotes'>;

const INITIAL_STATE: FormState = {
  companyLegalName: '',
  companyTradeName: '',
  technicalContactName: '',
  technicalContactEmail: '',
  technicalContactPhone: '',
  manufacturer: '',
  model: '',
  firmwareVersion: '',
  testImei: '',
  estimatedDeviceCount: undefined,
  protocol: 'GT06',
  transport: 'TCP',
  supportsDnsConfig: false,
  supportsIpConfig: false,
  supportsPortConfig: false,
  supportsApnConfig: false,
  supportsTransmissionIntervalConfig: false,
  supportsHeartbeatConfig: false,
  supportsTimezoneConfig: false,
  supportsPrimaryServerConfig: false,
  supportsSecondaryServerConfig: false,
  manualUrl: '',
  protocolDocUrl: '',
  commandTableUrl: '',
  firmwareDocUrl: '',
  payloadSampleText: '',
  configDocUrl: '',
  canTransmitToThirdPartyServer: false,
  supportsDnsResolution: false,
  hasManufacturerApi: false,
  manufacturerApiType: undefined,
  hasForwardingMirroring: false,
  forwardingDescription: '',
};

const PROTOCOL_OPTIONS: HomologationProtocol[] = [
  'GT06', 'GT06N', 'GT06E', 'H02', 'JT/T808', 'TK103', 'Protocolo proprietário', 'Outro',
];
const TRANSPORT_OPTIONS: HomologationTransport[] = ['TCP', 'UDP', 'HTTP', 'HTTPS', 'MQTT', 'Outro'];

const inputStyle = { borderColor: 'var(--h-line)', background: 'var(--h-onyx)', color: 'var(--h-white)' };

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-3">
    <h4 className="text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--h-gold-bright)' }}>
      {title}
    </h4>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
  </div>
);

const Field: React.FC<{ label: string; required?: boolean; full?: boolean; children: React.ReactNode }> = ({
  label, required, full, children,
}) => (
  <label className={`flex flex-col gap-1.5 text-xs ${full ? 'sm:col-span-2' : ''}`} style={{ color: 'var(--h-mute)' }}>
    <span>{label}{required && <span style={{ color: 'var(--h-gold)' }}> *</span>}</span>
    {children}
  </label>
);

const inputClass =
  'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--h-gold)]';

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({
  label, checked, onChange,
}) => (
  <div className="flex items-center justify-between py-1.5 text-xs sm:col-span-2" style={{ color: 'var(--h-white)' }}>
    <span>{label}</span>
    <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'var(--h-line)' }}>
      {(['SIM', 'NÃO'] as const).map((opt) => {
        const active = (opt === 'SIM') === checked;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt === 'SIM')}
            className="px-3 py-1.5 h-mono text-[11px] transition-colors"
            style={{
              background: active ? 'var(--h-gold)' : 'transparent',
              color: active ? '#0b0d10' : 'var(--h-mute)',
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  </div>
);

interface Props {
  onSubmitted: (request: HomologationRequest) => void;
}

export const HomologationForm: React.FC<Props> = ({ onSubmitted }) => {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validate = (): string | null => {
    if (!form.companyLegalName.trim()) return 'Informe a razão social.';
    if (!form.technicalContactName.trim()) return 'Informe o nome do responsável técnico.';
    if (!/^\S+@\S+\.\S+$/.test(form.technicalContactEmail)) return 'E-mail do responsável técnico inválido.';
    if (!form.technicalContactPhone.trim()) return 'Informe o telefone do responsável técnico.';
    if (!form.manufacturer.trim()) return 'Informe o fabricante.';
    if (!form.model.trim()) return 'Informe o modelo.';
    if (!/^\d{10,17}$/.test(form.testImei.trim())) return 'IMEI de teste deve conter apenas dígitos (10 a 17).';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);

    const payload: FormState = {
      ...form,
      companyLegalName: form.companyLegalName.trim().slice(0, 200),
      companyTradeName: form.companyTradeName?.trim().slice(0, 200) || undefined,
      technicalContactName: form.technicalContactName.trim().slice(0, 150),
      technicalContactEmail: form.technicalContactEmail.trim().toLowerCase().slice(0, 200),
      technicalContactPhone: form.technicalContactPhone.trim().slice(0, 40),
      manufacturer: form.manufacturer.trim().slice(0, 150),
      model: form.model.trim().slice(0, 150),
      testImei: form.testImei.trim().slice(0, 20),
    };

    // anon só tem permissão de INSERT nesta tabela (sem SELECT) — pedir a
    // linha de volta via .select() exigiria RLS de leitura, que não damos ao
    // público por design. Por isso o id/session_token são gerados aqui e
    // enviados explicitamente no insert, em vez de esperar o retorno do banco.
    const id = crypto.randomUUID();
    const sessionToken = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const { error: insertError } = await supabase
      .from('homologation_requests')
      .insert({ id, session_token: sessionToken, ...homologationRequestToInsertRow(payload) });

    setSubmitting(false);

    if (insertError) {
      console.error('[HomologationForm] submit:', insertError.message);
      setError('Não foi possível enviar a solicitação agora. Tente novamente em instantes.');
      return;
    }

    onSubmitted({
      id,
      sessionToken,
      status: 'pending_review',
      createdAt,
      ...payload,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Section title="Empresa">
        <Field label="Razão Social" required full>
          <input className={inputClass} style={inputStyle} value={form.companyLegalName}
            onChange={(e) => set('companyLegalName', e.target.value)} required />
        </Field>
        <Field label="Nome Fantasia">
          <input className={inputClass} style={inputStyle} value={form.companyTradeName}
            onChange={(e) => set('companyTradeName', e.target.value)} />
        </Field>
        <Field label="Responsável Técnico" required>
          <input className={inputClass} style={inputStyle} value={form.technicalContactName}
            onChange={(e) => set('technicalContactName', e.target.value)} required />
        </Field>
        <Field label="E-mail" required>
          <input type="email" className={inputClass} style={inputStyle} value={form.technicalContactEmail}
            onChange={(e) => set('technicalContactEmail', e.target.value)} required />
        </Field>
        <Field label="Telefone" required>
          <input className={inputClass} style={inputStyle} value={form.technicalContactPhone}
            onChange={(e) => set('technicalContactPhone', e.target.value)} required />
        </Field>
      </Section>

      <Section title="Equipamento">
        <Field label="Fabricante" required>
          <input className={inputClass} style={inputStyle} value={form.manufacturer}
            onChange={(e) => set('manufacturer', e.target.value)} required />
        </Field>
        <Field label="Modelo" required>
          <input className={inputClass} style={inputStyle} value={form.model}
            onChange={(e) => set('model', e.target.value)} required />
        </Field>
        <Field label="Firmware">
          <input className={inputClass} style={inputStyle} value={form.firmwareVersion}
            onChange={(e) => set('firmwareVersion', e.target.value)} />
        </Field>
        <Field label="IMEI de Teste" required>
          <input className={`${inputClass} h-mono`} style={inputStyle} value={form.testImei} inputMode="numeric"
            onChange={(e) => set('testImei', e.target.value.replace(/[^\d]/g, ''))} required />
        </Field>
        <Field label="Quantidade Estimada de Dispositivos">
          <input type="number" min={0} className={inputClass} style={inputStyle}
            value={form.estimatedDeviceCount ?? ''}
            onChange={(e) => set('estimatedDeviceCount', e.target.value ? Number(e.target.value) : undefined)} />
        </Field>
      </Section>

      <Section title="Comunicação e Transporte">
        <Field label="Protocolo utilizado" required>
          <select className={inputClass} style={inputStyle} value={form.protocol}
            onChange={(e) => set('protocol', e.target.value as HomologationProtocol)}>
            {PROTOCOL_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Transporte" required>
          <select className={inputClass} style={inputStyle} value={form.transport}
            onChange={(e) => set('transport', e.target.value as HomologationTransport)}>
            {TRANSPORT_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </Section>

      <Section title="Informações Técnicas — o dispositivo permite configurar">
        <Toggle label="DNS / Hostname?" checked={form.supportsDnsConfig} onChange={(v) => set('supportsDnsConfig', v)} />
        <Toggle label="IP?" checked={form.supportsIpConfig} onChange={(v) => set('supportsIpConfig', v)} />
        <Toggle label="Porta?" checked={form.supportsPortConfig} onChange={(v) => set('supportsPortConfig', v)} />
        <Toggle label="APN?" checked={form.supportsApnConfig} onChange={(v) => set('supportsApnConfig', v)} />
        <Toggle label="Intervalo de transmissão?" checked={form.supportsTransmissionIntervalConfig}
          onChange={(v) => set('supportsTransmissionIntervalConfig', v)} />
        <Toggle label="Heartbeat?" checked={form.supportsHeartbeatConfig} onChange={(v) => set('supportsHeartbeatConfig', v)} />
        <Toggle label="Timezone?" checked={form.supportsTimezoneConfig} onChange={(v) => set('supportsTimezoneConfig', v)} />
        <Toggle label="Servidor primário?" checked={form.supportsPrimaryServerConfig}
          onChange={(v) => set('supportsPrimaryServerConfig', v)} />
        <Toggle label="Servidor secundário?" checked={form.supportsSecondaryServerConfig}
          onChange={(v) => set('supportsSecondaryServerConfig', v)} />
      </Section>

      <Section title="Documentação (texto ou link)">
        <Field label="Manual do equipamento (URL)">
          <input className={inputClass} style={inputStyle} value={form.manualUrl}
            onChange={(e) => set('manualUrl', e.target.value)} />
        </Field>
        <Field label="Documentação do protocolo (URL)">
          <input className={inputClass} style={inputStyle} value={form.protocolDocUrl}
            onChange={(e) => set('protocolDocUrl', e.target.value)} />
        </Field>
        <Field label="Tabela de comandos (URL)">
          <input className={inputClass} style={inputStyle} value={form.commandTableUrl}
            onChange={(e) => set('commandTableUrl', e.target.value)} />
        </Field>
        <Field label="Documentação do firmware (URL)">
          <input className={inputClass} style={inputStyle} value={form.firmwareDocUrl}
            onChange={(e) => set('firmwareDocUrl', e.target.value)} />
        </Field>
        <Field label="Documentação de configuração (URL)">
          <input className={inputClass} style={inputStyle} value={form.configDocUrl}
            onChange={(e) => set('configDocUrl', e.target.value)} />
        </Field>
        <Field label="Exemplo de payload" full>
          <textarea rows={3} className={`${inputClass} h-mono`} style={inputStyle} value={form.payloadSampleText}
            onChange={(e) => set('payloadSampleText', e.target.value)} placeholder="78 78 0D 01 ..." />
        </Field>
      </Section>

      <Section title="Integração">
        <Toggle label="O dispositivo pode transmitir diretamente para servidor de terceiros?"
          checked={form.canTransmitToThirdPartyServer} onChange={(v) => set('canTransmitToThirdPartyServer', v)} />
        <Toggle label="Permite configuração de DNS?" checked={form.supportsDnsResolution}
          onChange={(v) => set('supportsDnsResolution', v)} />
        <Toggle label="Existe API do fabricante?" checked={form.hasManufacturerApi}
          onChange={(v) => set('hasManufacturerApi', v)} />
        {form.hasManufacturerApi && (
          <Field label="Tipo de API" full>
            <select className={inputClass} style={inputStyle} value={form.manufacturerApiType ?? ''}
              onChange={(e) => set('manufacturerApiType', e.target.value as FormState['manufacturerApiType'])}>
              <option value="">Selecione...</option>
              {(['REST', 'SOAP', 'WebSocket', 'MQTT', 'Outra'] as const).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        )}
        <Toggle label="Existe opção de espelhamento/forwarding?" checked={form.hasForwardingMirroring}
          onChange={(v) => set('hasForwardingMirroring', v)} />
        {form.hasForwardingMirroring && (
          <Field label="Descrição técnica do forwarding" full>
            <textarea rows={2} className={inputClass} style={inputStyle} value={form.forwardingDescription}
              onChange={(e) => set('forwardingDescription', e.target.value)} />
          </Field>
        )}
      </Section>

      {error && (
        <p className="text-xs h-mono" style={{ color: 'var(--h-error)' }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full sm:w-auto px-6 py-3 rounded-xl h-mono text-xs uppercase tracking-[0.15em] font-semibold transition-opacity disabled:opacity-50"
        style={{ background: 'var(--h-gold)', color: '#0b0d10' }}
      >
        {submitting ? 'Enviando...' : 'Enviar Solicitação de Homologação'}
      </button>
    </form>
  );
};
