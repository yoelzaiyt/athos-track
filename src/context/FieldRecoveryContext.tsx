import React, { createContext, useContext, useState, useEffect } from 'react';
import { FieldRecoveryOccurrence, FieldRecoveryStatus, FieldRecoveryTimelineStep } from '../types';
import { supabase } from '../lib/supabaseClient';
import {
  rowToRecoveryOccurrence,
  recoveryOccurrenceToInsertRow,
  recoveryOccurrenceUpdatesToRow,
  rowToRecoveryTimelineEvent,
} from '../lib/mappers';

type NewOccurrenceInput = Omit<
  FieldRecoveryOccurrence,
  'id' | 'createdAt' | 'timeline' | 'secureToken' | 'tokenExpiresAt' | 'tokenRevoked' | 'status'
> & { status?: FieldRecoveryStatus };

interface FieldRecoveryContextType {
  occurrences: FieldRecoveryOccurrence[];
  isLoading: boolean;
  createOccurrence: (payload: NewOccurrenceInput) => Promise<FieldRecoveryOccurrence | null>;
  assignOccurrence: (id: string, userName: string) => Promise<void>;
  updateOccurrenceStatus: (
    id: string,
    status: FieldRecoveryStatus,
    timelineStep?: FieldRecoveryTimelineStep,
    userName?: string,
    note?: string
  ) => Promise<void>;
  cancelOccurrence: (id: string, reason: string) => Promise<void>;
  refreshOccurrence: (id: string) => Promise<void>;
}

const FieldRecoveryContext = createContext<FieldRecoveryContextType | undefined>(undefined);

function logError(label: string, error: { message: string } | null) {
  if (error) console.error(`[FieldRecoveryContext] ${label}:`, error.message);
}

async function fetchTimelineFor(occurrenceId: string) {
  const { data, error } = await supabase
    .from('recovery_timeline_events')
    .select('*')
    .eq('occurrence_id', occurrenceId)
    .order('created_at', { ascending: true });
  logError('fetchTimelineFor', error);
  return (data ?? []).map(rowToRecoveryTimelineEvent);
}

export const FieldRecoveryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [occurrences, setOccurrences] = useState<FieldRecoveryOccurrence[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [occRes, evRes] = await Promise.all([
        supabase.from('recovery_occurrences').select('*').order('created_at', { ascending: false }),
        supabase.from('recovery_timeline_events').select('*').order('created_at', { ascending: true }),
      ]);
      if (cancelled) return;

      logError('load occurrences', occRes.error);
      logError('load timeline', evRes.error);

      const eventsByOccurrence = new Map<string, ReturnType<typeof rowToRecoveryTimelineEvent>[]>();
      (evRes.data ?? []).forEach((row) => {
        const list = eventsByOccurrence.get(row.occurrence_id) ?? [];
        list.push(rowToRecoveryTimelineEvent(row));
        eventsByOccurrence.set(row.occurrence_id, list);
      });

      setOccurrences(
        (occRes.data ?? []).map((row) => rowToRecoveryOccurrence(row, eventsByOccurrence.get(row.id) ?? []))
      );
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshOccurrence = async (id: string) => {
    const { data, error } = await supabase.from('recovery_occurrences').select('*').eq('id', id).single();
    logError('refreshOccurrence', error);
    if (error || !data) return;
    const timeline = await fetchTimelineFor(id);
    const updated = rowToRecoveryOccurrence(data, timeline);
    setOccurrences((prev) => prev.map((o) => (o.id === id ? updated : o)));
  };

  const createOccurrence = async (payload: NewOccurrenceInput): Promise<FieldRecoveryOccurrence | null> => {
    const row = recoveryOccurrenceToInsertRow({ ...payload, status: payload.status ?? 'detectado' });
    const { data, error } = await supabase.from('recovery_occurrences').insert(row).select().single();
    logError('createOccurrence', error);
    if (error || !data) return null;

    await supabase.from('recovery_timeline_events').insert([
      { occurrence_id: data.id, step: 'exit_detectado', user_name: 'Sistema (simulado)' },
      { occurrence_id: data.id, step: 'ocorrencia_criada', user_name: 'Sistema (simulado)' },
    ]);

    const timeline = await fetchTimelineFor(data.id);
    const occurrence = rowToRecoveryOccurrence(data, timeline);
    setOccurrences((prev) => [occurrence, ...prev]);
    return occurrence;
  };

  const assignOccurrence = async (id: string, userName: string) => {
    const updates = {
      status: 'atribuido' as FieldRecoveryStatus,
      assignedUserName: userName,
      assignedAt: new Date().toISOString(),
    };
    const { error } = await supabase
      .from('recovery_occurrences')
      .update(recoveryOccurrenceUpdatesToRow(updates))
      .eq('id', id);
    logError('assignOccurrence', error);
    if (error) return;
    await supabase.from('recovery_timeline_events').insert({ occurrence_id: id, step: 'atribuido', user_name: userName });
    await refreshOccurrence(id);
  };

  const updateOccurrenceStatus = async (
    id: string,
    status: FieldRecoveryStatus,
    timelineStep?: FieldRecoveryTimelineStep,
    userName?: string,
    note?: string
  ) => {
    const { error } = await supabase
      .from('recovery_occurrences')
      .update(recoveryOccurrenceUpdatesToRow({ status }))
      .eq('id', id);
    logError('updateOccurrenceStatus', error);
    if (error) return;
    if (timelineStep) {
      await supabase
        .from('recovery_timeline_events')
        .insert({ occurrence_id: id, step: timelineStep, user_name: userName, note });
    }
    await refreshOccurrence(id);
  };

  const cancelOccurrence = async (id: string, reason: string) => {
    const { error } = await supabase
      .from('recovery_occurrences')
      .update(recoveryOccurrenceUpdatesToRow({ status: 'cancelado', cancelReason: reason }))
      .eq('id', id);
    logError('cancelOccurrence', error);
    if (error) return;
    await supabase
      .from('recovery_timeline_events')
      .insert({ occurrence_id: id, step: 'ocorrencia_encerrada', note: reason });
    await refreshOccurrence(id);
  };

  return (
    <FieldRecoveryContext.Provider
      value={{
        occurrences,
        isLoading,
        createOccurrence,
        assignOccurrence,
        updateOccurrenceStatus,
        cancelOccurrence,
        refreshOccurrence,
      }}
    >
      {children}
    </FieldRecoveryContext.Provider>
  );
};

export const useFieldRecovery = () => {
  const ctx = useContext(FieldRecoveryContext);
  if (!ctx) throw new Error('useFieldRecovery must be used within a FieldRecoveryProvider');
  return ctx;
};
