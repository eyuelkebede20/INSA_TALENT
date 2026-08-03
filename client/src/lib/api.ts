import { createAuthClient } from "better-auth/react";

// Vite injects VITE_ prefixed environment variables into import.meta.env
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://insa-talent-1.onrender.com/api";
export const SERVER_BASE_URL = API_BASE_URL.replace('/api', '');

// Better Auth client configuration
export const authClient = createAuthClient({
    baseURL: SERVER_BASE_URL
});

export const { signIn, signOut, useSession } = authClient;

// Helper function for API calls
export async function fetchApi(endpoint: string, options?: RequestInit) {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options?.headers,
        },
    });
    
    if (!res.ok) {
        throw new Error(`API Error: ${res.statusText}`);
    }
    
    return res.json();
}
