import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  HomologationRequest,
  HomologationDevice,
  HomologationEvent,
  HomologationReport,
} from '../types/homologation';
import { supabase } from '../lib/supabaseClient';
import {
  rowToHomologationRequest, homologationRequestUpdatesToRow,
  rowToHomologationDevice,
  rowToHomologationEvent,
  rowToHomologationReport,
} from '../lib/mappers';

interface HomologationAdminContextType {
  requests: HomologationRequest[];
  devices: HomologationDevice[];
  events: HomologationEvent[];
  reports: HomologationReport[];
  isLoading: boolean;
  updateRequestStatus: (id: string, status: HomologationRequest['status']) => Promise<void>;
  updateRequestNotes: (id: string, adminNotes: string) => Promise<void>;
  updateRequestFields: (id: string, updates: Partial<HomologationRequest>) => Promise<boolean>;
}

const HomologationAdminContext = createContext<HomologationAdminContextType | undefined>(undefined);

function logError(label: string, error: { message: string } | null) {
  if (error) console.error(`[HomologationAdminContext] ${label}:`, error.message);
}

export const HomologationAdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [requests, setRequests] = useState<HomologationRequest[]>([]);
  const [devices, setDevices] = useState<HomologationDevice[]>([]);
  const [events, setEvents] = useState<HomologationEvent[]>([]);
  const [reports, setReports] = useState<HomologationReport[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [requestsRes, devicesRes, eventsRes, reportsRes] = await Promise.all([
        supabase.from('homologation_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('homologation_devices').select('*').order('created_at', { ascending: false }),
        supabase.from('homologation_events').select('*').order('created_at', { ascending: false }),
        supabase.from('homologation_reports').select('*').order('created_at', { ascending: false }),
      ]);

      if (cancelled) return;

      logError('requests', requestsRes.error);
      logError('devices', devicesRes.error);
      logError('events', eventsRes.error);
      logError('reports', reportsRes.error);

      setRequests((requestsRes.data ?? []).map(rowToHomologationRequest));
      setDevices((devicesRes.data ?? []).map(rowToHomologationDevice));
      setEvents((eventsRes.data ?? []).map(rowToHomologationEvent));
      setReports((reportsRes.data ?? []).map(rowToHomologationReport));
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Genérico: cobre status/notas e também os campos editáveis pela equipe
  // ATHOS no drawer (IMEI de teste, protocolo/transporte, fabricante/modelo,
  // firmware) — a solicitação original vem do fornecedor via portal público,
  // mas a equipe interna pode corrigir/ajustar depois de revisar.
  const updateRequestFields = async (id: string, updates: Partial<HomologationRequest>) => {
    const { error } = await supabase
      .from('homologation_requests')
      .update(homologationRequestUpdatesToRow(updates))
      .eq('id', id);
    logError('updateRequestFields', error);
    if (error) return false;
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
    return true;
  };

  const updateRequestStatus = async (id: string, status: HomologationRequest['status']) => {
    await updateRequestFields(id, { status });
  };

  const updateRequestNotes = async (id: string, adminNotes: string) => {
    await updateRequestFields(id, { adminNotes });
  };

  return (
    <HomologationAdminContext.Provider
      value={{ requests, devices, events, reports, isLoading, updateRequestStatus, updateRequestNotes, updateRequestFields }}
    >
      {children}
    </HomologationAdminContext.Provider>
  );
};

export const useHomologationAdmin = () => {
  const context = useContext(HomologationAdminContext);
  if (!context) throw new Error('useHomologationAdmin must be used within a HomologationAdminProvider');
  return context;
};
