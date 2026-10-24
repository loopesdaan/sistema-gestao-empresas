import React, { createContext, useContext, useReducer, useCallback } from 'react';

export interface Notificacao {
  id: string;
  tipo: 'erro' | 'aviso' | 'sucesso' | 'info';
  titulo: string;
  mensagem: string;
  lido: boolean;
  created_at: Date;
}

interface NotificationState {
  notificacoes: Notificacao[];
}

type NotificationAction =
  | { type: 'ADD'; payload: Omit<Notificacao, 'id' | 'lido' | 'created_at'> }
  | { type: 'MARK_READ'; payload: string }
  | { type: 'MARK_ALL_READ' }
  | { type: 'CLEAR_ALL' };

// Reducer para gerenciar o estado das notificações
const notificationReducer = (state: NotificationState, action: NotificationAction): NotificationState => {
  switch (action.type) {
    case 'ADD':
      return {
        notificacoes: [
          {
            ...action.payload,
            id: `${Date.now()}-${Math.random()}`,
            lido: false,
            created_at: new Date(),
          },
          ...state.notificacoes,
        ],
      };
    case 'MARK_READ':
      return {
        notificacoes: state.notificacoes.map(n =>
          n.id === action.payload ? { ...n, lido: true } : n
        ),
      };
    case 'MARK_ALL_READ':
      return { notificacoes: state.notificacoes.map(n => ({ ...n, lido: true })) };
    case 'CLEAR_ALL':
      return { notificacoes: [] };
    default:
      return state;
  }
};

interface NotificationContextType {
  notificacoes: Notificacao[];
  naoLidas: number;
  addNotificacao: (n: Omit<Notificacao, 'id' | 'lido' | 'created_at'>) => void;
  marcarLida: (id: string) => void;
  marcarTodasLidas: () => void;
  limparTodas: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, { notificacoes: [] });

  const addNotificacao = useCallback((n: Omit<Notificacao, 'id' | 'lido' | 'created_at'>) => {
    dispatch({ type: 'ADD', payload: n });
  }, []);

  const marcarLida = useCallback((id: string) => {
    dispatch({ type: 'MARK_READ', payload: id });
  }, []);

  const marcarTodasLidas = useCallback(() => {
    dispatch({ type: 'MARK_ALL_READ' });
  }, []);

  const limparTodas = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  return (
    <NotificationContext.Provider value={{
      notificacoes: state.notificacoes,
      naoLidas: state.notificacoes.filter(n => !n.lido).length,
      addNotificacao,
      marcarLida,
      marcarTodasLidas,
      limparTodas,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificacoes = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotificacoes must be used within NotificationProvider');
  return ctx;
};
