import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

type Mode = "login" | "register";

export function AuthScreen() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);

  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const run = mode === "login" ? authApi.login : authApi.register;
      const { accessToken, user } = await run(username.trim(), password);
      setAuth(accessToken, user);
      navigate("/", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "문제가 발생했어요.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
  };

  if (token) return <Navigate to="/" replace />;

  return (
    <div className="brutal-bg flex min-h-svh items-center justify-center p-4">
      <Card as="main" className="w-full max-w-md p-7">
        <div className="flex flex-col items-center text-center">
          <span className="mb-4 flex size-16 -rotate-6 items-center justify-center rounded-xl border-[3px] border-ink bg-brand-yellow text-ink shadow-hard">
            <Pencil className="size-8" strokeWidth={2.5} />
          </span>
          <h1 className="text-4xl font-black tracking-tighter text-ink">
            Sketch
            <span className="ml-1 inline-block rotate-2 bg-brand-pink px-2 text-white [-webkit-text-stroke:1.5px_var(--color-ink)]">
              Quiz
            </span>
          </h1>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`press rounded-xl border-[3px] border-ink py-2 text-sm font-black ${
                mode === m ? "bg-brand-blue text-ink" : "bg-white text-ink/60"
              }`}
            >
              {m === "login" ? "로그인" : "회원가입"}
            </button>
          ))}
        </div>

        <form
          className="mt-6 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!loading) void submit();
          }}
        >
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-black uppercase tracking-wide">
              아이디
            </label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
              placeholder="영문·숫자·밑줄, 3~20자"
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-black uppercase tracking-wide">
              비밀번호
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={72}
              placeholder="4자 이상"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {error && (
            <p
              role="alert"
              className="border-2 border-ink bg-brand-red px-3 py-2 text-sm font-bold text-ink shadow-hard"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            variant={mode === "login" ? "green" : "pink"}
            disabled={loading}
            className={`w-full text-base ${mode === "register" ? "text-white" : ""}`}
          >
            {loading ? "잠시만요..." : mode === "login" ? "로그인" : "회원가입"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
