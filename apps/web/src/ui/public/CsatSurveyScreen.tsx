"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiSend, isApiError } from "../api";

type SurveyPayload = {
  brand?: string | null;
  conversation_id?: string;
  already_submitted?: boolean;
};

export function CsatSurveyScreen() {
  const { token } = useParams<{ token: string }>();
  const [payload, setPayload] = useState<SurveyPayload | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error" | "done" | "gone">("loading");
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const data = await apiGet<SurveyPayload>(`/api/public/csat/${token}`);
      setPayload(data);
      setStatus(data.already_submitted ? "done" : "ok");
    } catch (err) {
      if (isApiError(err) && (err.status === 404 || err.status === 410)) setStatus("gone");
      else setStatus("error");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return;
    setBusy(true);
    setError(null);
    try {
      await apiSend(`/api/public/csat/${token}`, "POST", {
        rating,
        feedback_message: feedback.trim() || undefined,
      });
      setStatus("done");
    } catch (err) {
      if (isApiError(err) && err.status === 409) setStatus("done");
      else setError(isApiError(err) ? err.message : "Não foi possível enviar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{payload?.brand || "Pesquisa de satisfação"}</CardTitle>
        </CardHeader>
        <CardContent>
          {status === "loading" ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : status === "gone" ? (
            <p className="text-sm text-muted-foreground">Pesquisa indisponível ou expirada.</p>
          ) : status === "error" ? (
            <div className="space-y-3">
              <p className="text-sm text-red-500">Não foi possível carregar a pesquisa.</p>
              <Button type="button" variant="outline" onClick={() => void load()}>
                Tentar de novo
              </Button>
            </div>
          ) : status === "done" ? (
            <p className="text-sm text-muted-foreground">Obrigado pela sua avaliação.</p>
          ) : (
            <form className="space-y-4" onSubmit={onSubmit}>
              <p className="text-sm text-muted-foreground">Como foi o atendimento?</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant={rating === n ? "default" : "outline"}
                    className="min-w-10"
                    onClick={() => setRating(n)}
                  >
                    {n}
                  </Button>
                ))}
              </div>
              <Textarea
                placeholder="Comentário (opcional)"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
              />
              {error ? <p className="text-sm text-red-500">{error}</p> : null}
              <Button type="submit" disabled={busy || !rating} className="w-full">
                Enviar
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
