export interface UserSession {
  id: number;
  email: string;
  nome: string;
  role: string;
}

export async function validateAuthToken(token: string): Promise<UserSession | null> {
  if (!token) return null;
  // Simulação de validação de token / sessão
  return {
    id: 1,
    email: "admin@proar.com.br",
    nome: "Administrador ProAR",
    role: "admin",
  };
}
