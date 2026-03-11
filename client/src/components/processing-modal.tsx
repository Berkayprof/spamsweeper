import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, AlertCircle, RotateCw, ExternalLink } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ProcessingModalProps {
  isOpen: boolean;
  onClose: () => void;
  emailCount: number;
  scanId: number | null;
}

export default function ProcessingModal({ isOpen, onClose, emailCount, scanId }: ProcessingModalProps) {
  const pollingActive = useRef(true);

  useEffect(() => {
    pollingActive.current = true;
    return () => { pollingActive.current = false; };
  }, [isOpen]);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/scan", scanId, "unsubscribe-results"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/scan/${scanId}/unsubscribe-results`);
      return response.json();
    },
    enabled: isOpen && !!scanId,
    refetchInterval: (query) => {
      const data = query.state.data as any;
      if (!pollingActive.current) return false;
      if (data?.completed) return false;
      return 2000;
    },
  });

  const total = data?.total ?? emailCount;
  const processed = data?.processed ?? 0;
  const progress = total > 0 ? (processed / total) * 100 : 0;
  const isCompleted = data?.completed ?? false;
  const results = data?.results ?? [];

  const statusIcon = (status: string | null) => {
    if (status === 'success') return <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />;
    if (status === 'failed') return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
    if (status === 'unclear') return <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />;
    return <RotateCw className="h-4 w-4 text-blue-400 animate-spin shrink-0" />;
  };

  const statusLabel = (status: string | null) => {
    if (status === 'success') return 'Gelukt';
    if (status === 'failed') return 'Mislukt';
    if (status === 'unclear') return 'Onduidelijk';
    return 'Bezig...';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCw className={`h-5 w-5 ${isCompleted ? '' : 'animate-spin text-blue-500'}`} />
            {isCompleted ? 'Uitschrijven voltooid' : 'Uitschrijven verwerken...'}
          </DialogTitle>
          <DialogDescription>
            {isCompleted
              ? `${data?.successful ?? 0} geslaagd · ${data?.failed ?? 0} mislukt · ${data?.unclear ?? 0} onduidelijk`
              : `${processed} van ${total} emails verwerkt`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <Progress value={progress} className="h-2" />

          {isLoading && results.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              <RotateCw className="h-4 w-4 animate-spin mr-2" />
              Resultaten ophalen...
            </div>
          ) : (
            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {results.map((email: any) => (
                <div
                  key={email.id}
                  className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm"
                >
                  {statusIcon(email.isProcessed ? email.unsubscribeStatus : null)}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{email.sender}</span>
                      <span className={`shrink-0 text-xs font-medium ${
                        email.unsubscribeStatus === 'success' ? 'text-green-600' :
                        email.unsubscribeStatus === 'failed' ? 'text-red-600' :
                        email.unsubscribeStatus === 'unclear' ? 'text-yellow-600' :
                        'text-blue-500'
                      }`}>
                        {statusLabel(email.isProcessed ? email.unsubscribeStatus : null)}
                      </span>
                    </div>
                    <p className="text-muted-foreground truncate">{email.subject}</p>
                    {email.isProcessed && email.unsubscribeMessage && (
                      <p className="text-xs text-muted-foreground mt-1">{email.unsubscribeMessage}</p>
                    )}
                    {email.unsubscribeUrl && (
                      <a
                        href={email.unsubscribeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline mt-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        URL bekijken
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {isCompleted && (
          <Button onClick={onClose} className="mt-2 w-full">
            Sluiten
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
