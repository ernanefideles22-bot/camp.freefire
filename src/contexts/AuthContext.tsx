import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';

interface Jogador {
  id: number;
  nome: string;
  nick: string;
  saldo: number;
  is_admin: boolean;
}

interface AuthContextData {
  jogador: Jogador | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (nick: string, senha: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [jogador, setJogador] = useState<Jogador | null>(null);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!jogador;
  const isAdmin = jogador?.is_admin || false;

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const savedUser = localStorage.getItem('jogador');

    if (token && savedUser) {
      try {
        setJogador(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('jogador');
      }
    }
    setLoading(false);
  }, []);

  const login = async (nick: string, senha: string): Promise<boolean> => {
    try {
      const response = await api.post('/auth/login', { nick, senha });
      
      const { access_token, jogador: userData } = response.data;
      
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('jogador', JSON.stringify(userData));
      
      setJogador(userData);
      return true;
    } catch (error: any) {
      console.error("Erro no login:", error.response?.data || error);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('jogador');
    setJogador(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ jogador, isAuthenticated, isAdmin, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);