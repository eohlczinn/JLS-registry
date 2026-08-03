import { useEffect, useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
const auth = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem("jls-token")}` },
});
export default function Settings() {
  const { user } = useAuth(),
    [form, setForm] = useState({
      language: "pt-BR",
      theme: "dark",
      notifications: true,
      privacy_profile: true,
      github: "",
      website: "",
    }),
    [profile, setProfile] = useState({}),
    [notice, setNotice] = useState("");
  useEffect(() => {
    Promise.all([api.get("/settings", auth()), api.get("/profile", auth())])
      .then(([s, p]) => {
        setForm(s.data);
        setProfile({
          ...p.data.user,
          bio: p.data.bio,
          github: p.data.preferences.github || "",
          website: p.data.preferences.website || "",
        });
        document.documentElement.dataset.theme = s.data.theme;
      })
      .catch((x) =>
        setNotice(
          x.response?.data?.error ||
            "Entre na sua conta para alterar configurações.",
        ),
      );
  }, []);
  const saveSettings = async (e) => {
    e.preventDefault();
    try {
      const r = await api.put("/settings", form, auth());
      document.documentElement.dataset.theme = r.data.theme;
      localStorage.setItem("jls-theme", r.data.theme);
      setNotice("Preferências salvas automaticamente.");
    } catch (x) {
      setNotice(x.response?.data?.error || "Erro ao salvar.");
    }
  };
  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      await api.put("/profile", profile, auth());
      setNotice("Perfil atualizado.");
    } catch (x) {
      setNotice(x.response?.data?.error || "Erro ao atualizar perfil.");
    }
  };
  const set = (key, value) => setForm({ ...form, [key]: value });
  return (
    <section>
      <div className="page-head">
        <div>
          <h1>Configurações</h1>
          <p>Personalize sua conta e a experiência do JL Registry.</p>
        </div>
      </div>
      {notice && (
        <p
          className={
            notice.includes("salv") || notice.includes("atualizado")
              ? "success"
              : "error"
          }
        >
          {notice}
        </p>
      )}
      <div className="settings-grid">
        <form className="panel" onSubmit={saveSettings}>
          <h2>Preferências gerais</h2>
          <label>
            Idioma
            <select
              value={form.language}
              onChange={(e) => set("language", e.target.value)}
            >
              <option value="pt-BR">Português</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            Tema
            <select
              value={form.theme}
              onChange={(e) => set("theme", e.target.value)}
            >
              <option value="dark">🌙 Escuro</option>
              <option value="light">☀ Claro</option>
            </select>
          </label>
          <label className="switch">
            <input
              type="checkbox"
              checked={form.notifications}
              onChange={(e) => set("notifications", e.target.checked)}
            />{" "}
            Receber notificações
          </label>
          <label className="switch">
            <input
              type="checkbox"
              checked={form.privacy_profile}
              onChange={(e) => set("privacy_profile", e.target.checked)}
            />{" "}
            Perfil público
          </label>
          <button className="button">Salvar preferências</button>
        </form>
        <form className="panel" onSubmit={saveProfile}>
          <h2>Perfil e segurança</h2>
          <div className="profile-preview">
            <div className="profile-photo">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt="Foto do perfil" />
              ) : (
                (profile.name || user?.name || "?").slice(0, 1).toUpperCase()
              )}
            </div>
            <div>
              <b>{profile.name || "Seu perfil"}</b>
              <p className="muted">
                Sua foto do Google aparece aqui e pode ser alterada.
              </p>
            </div>
          </div>
          <label>
            Nome
            <input
              value={profile.name || ""}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </label>
          <label>
            E-mail
            <input
              type="email"
              value={profile.email || ""}
              onChange={(e) =>
                setProfile({ ...profile, email: e.target.value })
              }
            />
          </label>
          <label>
            Foto (URL)
            <input
              value={profile.avatarUrl || ""}
              onChange={(e) =>
                setProfile({ ...profile, avatarUrl: e.target.value })
              }
            />
          </label>
          <label>
            GitHub
            <input
              value={profile.github || ""}
              onChange={(e) =>
                setProfile({ ...profile, github: e.target.value })
              }
            />
          </label>
          <label>
            Site
            <input
              value={profile.website || ""}
              onChange={(e) =>
                setProfile({ ...profile, website: e.target.value })
              }
            />
          </label>
          <label>
            Bio
            <textarea
              value={profile.bio || ""}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            />
          </label>
          <label>
            Nova senha
            <input
              type="password"
              minLength="6"
              placeholder="Deixe vazio para manter"
              onChange={(e) =>
                setProfile({ ...profile, password: e.target.value })
              }
            />
          </label>
          <button className="button">Salvar perfil</button>
        </form>
      </div>
    </section>
  );
}
