import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService } from '../services/api';
import type { Jogador } from '../services/api';

interface AuthContextData {
  jogador: Jogador | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (nick: string, senha: string) => Promise<Jogador>;
  logout: () => void;
  updateJogador: (user: Jogador) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [jogador, setJogador] = useState<Jogador | null>(null);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!jogador;
  const isAdmin = jogador?.is_admin || false;

  // FIX 1.3: usar as mesmas chaves que App.tsx (currentUser + access_token)
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const savedUser = localStorage.getItem('currentUser');

    if (token && savedUser) {
      try {
        setJogador(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('currentUser');
      }
    }
    setLoading(false);
  }, []);

  const login = async (nick: string, senha: string): Promise<Jogador> => {
    // FIX 1.3: usar apiService unificado em vez de fetch direto
    const user = await apiService.loginJogador(nick, senha);
    setJogador(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('currentUser');
    setJogador(null);
  };

  const updateJogador = (user: Jogador) => {
    setJogador(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  return (
    <AuthContext.Provider value={{ jogador, isAuthenticated, isAdmin, login, logout, updateJogador, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
