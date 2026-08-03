import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
const GoogleIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 48 48" width="20" height="20">
    <path
      fill="#FFC107"
      d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
    />
    <path
      fill="#FF3D00"
      d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
    />
    <path
      fill="#4CAF50"
      d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
    />
    <path
      fill="#1976D2"
      d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
    />
  </svg>
);
export default function Login() {
  const [register, setRegister] = useState(false),
    [form, setForm] = useState({}),
    [error, setError] = useState(""),
    nav = useNavigate(),
    { login } = useAuth(),
    googleRef = useRef(null),
    clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const googleLogin = async (credential) => {
    try {
      await login("/auth/google", { credential });
      nav("/dashboard");
    } catch (x) {
      setError(
        x.response?.data?.error || "Não foi possível entrar com Google.",
      );
    }
  };
  useEffect(() => {
    if (!clientId) return undefined;
    let script;
    const render = () => {
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: (r) => googleLogin(r.credential),
      });
      if (googleRef.current) {
        googleRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(googleRef.current, {
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text: "continue_with",
          width: 404,
        });
      }
    };
    if (window.google) render();
    else {
      script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = render;
      document.head.appendChild(script);
    }
    return () => {
      if (script) script.remove();
    };
  }, [clientId]);
  const send = async (e) => {
    e.preventDefault();
    try {
      await login(register ? "/auth/register" : "/auth/login", form);
      nav("/dashboard");
    } catch (x) {
      setError(
        x.response?.data?.error ||
          "O backend não está ativo. Execute npm run dev:all na pasta do JL Registry.",
      );
    }
  };
  const field = (key, label, type = "text") => (
    <label>
      {label}
      <input
        required
        minLength={key === "password" ? 6 : undefined}
        type={type}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </label>
  );
  return (
    <section className="auth-wrap">
      <div className="panel">
        <span className="tag">JL Registry</span>
        <h1>{register ? "Crie sua conta" : "Bem-vindo de volta"}</h1>
        <p className="muted">
          {register
            ? "Publique bibliotecas e acompanhe seus downloads."
            : "Entre para gerenciar suas bibliotecas."}
        </p>
        <form onSubmit={send}>
          {register && (
            <>
              {field("name", "Nome")}
              {field("username", "Usuário")}
            </>
          )}
          {field("email", "E-mail", "email")}
          {field("password", "Senha", "password")}
          {error && <p className="error">{error}</p>}
          <button className="button">
            {register ? "Criar conta" : "Entrar"}
          </button>
        </form>
        <div className="divider">ou</div>
        {clientId ? (
          <div className="google" ref={googleRef} />
        ) : (
          <button
            className="button secondary google-button"
            onClick={() =>
              setError(
                "VITE_GOOGLE_CLIENT_ID não foi encontrado. Reinicie o Vite após criar o arquivo .env.",
              )
            }
          >
            <GoogleIcon />
            Continuar com Google
          </button>
        )}
        <p className="muted">
          {register ? "Já possui conta? " : "Não possui conta? "}
          <button
            className="button secondary"
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register ? "Entrar" : "Criar conta"}
          </button>
        </p>
      </div>
    </section>
  );
}
