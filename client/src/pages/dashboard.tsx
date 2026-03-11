import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import { WashingMachine, LogOut, UserRound, Folder } from "lucide-react";
import { Footer } from "@/components/Footer";
import logoUrl from "@/assets/spam-sweeper-logo.png";
import StatusCards from "@/components/status-cards";
import EmailReviewTable from "@/components/email-review-table";
import ProcessingModal from "@/components/processing-modal";
import AIProgressModal from "@/components/ai-progress-modal";
import EmailPreviewModal from "@/components/email-preview-modal";
import FolderSelectionModal from "@/components/folder-selection-modal";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function Dashboard() {
  const { t } = useLanguage();
  const [match, params] = useRoute("/dashboard/:userId");
  const userId = params?.userId ? parseInt(params.userId) : null;
  
  const [currentScanId, setCurrentScanId] = useState<number | null>(null);
  const [isProcessingModalOpen, setIsProcessingModalOpen] = useState(false);
  const [isAIProgressModalOpen, setIsAIProgressModalOpen] = useState(false);
  const [previewEmailId, setPreviewEmailId] = useState<number | null>(null);
  const [scanData, setScanData] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isFolderSelectionOpen, setIsFolderSelectionOpen] = useState(false);

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["/api/user", userId],
    enabled: !!userId,
    staleTime: 300000, // Cache user data for 5 minutes
  });

  // Load latest scan data when dashboard loads
  const { data: latestScanData, isLoading: latestScanLoading } = useQuery({
    queryKey: ["/api/user", userId, "latest-scan"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/user/${userId}/latest-scan`);
      return response.json();
    },
    enabled: !!userId,
    staleTime: 60000, // Cache latest scan for 1 minute
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });

  // Update scanData when latest scan loads
  useEffect(() => {
    if (latestScanData && !currentScanId) {
      setScanData(latestScanData);
      if (latestScanData.scan) {
        setCurrentScanId(latestScanData.scan.id);
      }
    }
  }, [latestScanData, currentScanId]);

  // Simple fetch function for scan data
  const fetchScanData = async (scanId: number) => {
    try {
      const response = await apiRequest("GET", `/api/scan/${scanId}`);
      const data = await response.json();
      setScanData(data);
      return data;
    } catch (error) {
      console.error("Failed to fetch scan data:", error);
      return null;
    }
  };



  const handleSignOut = useCallback(() => {
    window.location.href = '/';
  }, []);

  const handleScanEmails = useCallback(async (folders?: string[]) => {
    if (!userId) return;
    
    try {
      setIsScanning(true);
      const response = await apiRequest("POST", `/api/scan/${userId}`, { folders });
      const data = await response.json();
      setCurrentScanId(data.scanId);
      
      // Open AI progress modal to show real-time progress
      setIsAIProgressModalOpen(true);
    } catch (error) {
      console.error("Scan error:", error);
      setIsScanning(false);
    }
  }, [userId]);

  const handleQuickScan = useCallback(() => {
    // Quick scan only scans the default spam folder
    handleScanEmails();
  }, [handleScanEmails]);

  const handleFullScan = useCallback(() => {
    // Open folder selection modal for full scan
    setIsFolderSelectionOpen(true);
  }, []);

  const handleFolderSelection = useCallback((selectedFolders: string[]) => {
    setIsFolderSelectionOpen(false);
    handleScanEmails(selectedFolders);
  }, [handleScanEmails]);

  const handleAIProgressComplete = useCallback((data: any) => {
    setScanData(data);
    setIsScanning(false);
    setIsAIProgressModalOpen(false);
  }, []);

  const handleAIProgressClose = useCallback(() => {
    setIsAIProgressModalOpen(false);
    setIsScanning(false);
  }, []);

  const handleRefresh = () => {
    if (currentScanId) {
      fetchScanData(currentScanId);
    }
    // Also invalidate the latest scan cache
    queryClient.invalidateQueries({ queryKey: ["/api/user", userId, "latest-scan"] });
  };

  const handleProcessUnsubscribes = async () => {
    if (!currentScanId) return;
    
    try {
      setIsProcessingModalOpen(true);
      await apiRequest("POST", `/api/process-unsubscribes/${currentScanId}`);
      // Modal will handle the progress simulation
    } catch (error) {
      console.error("Process error:", error);
      setIsProcessingModalOpen(false);
    }
  };

  if (!match || !userId) {
    return <div>{t.dashboard.invalidUrl}</div>;
  }

  if (userLoading || latestScanLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <div className="ml-3">{t.dashboard.loading}</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>{t.dashboard.userNotFound}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      {/* Navigation */}
      <nav className="bg-card shadow-sm border-b border-border animate-slide-in">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <img src={logoUrl} alt="Spam Sweeper Logo" className="h-10 w-10 sm:h-12 sm:w-12 mr-3 rounded-lg animate-bounce-in" style={{ borderRadius: '7px' }} />
              <h1 className="text-lg sm:text-xl font-medium text-foreground">Spam Sweeper</h1>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="hidden sm:flex items-center text-sm text-muted-foreground">
                <UserRound className="text-success text-lg mr-1 animate-pulse" />
                <span className="truncate max-w-32 lg:max-w-none">{user.email}</span>
              </div>
              <LanguageSelector />
              <ThemeToggle />
              <Button 
                onClick={handleSignOut}
                variant="outline"
                className="flex items-center transition-all duration-300 hover:scale-105"
                size="sm"
              >
                <LogOut className="mr-1 h-4 w-4" />
                <span className="hidden sm:inline">{t.dashboard.signOut}</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Dashboard Header */}
        <div className="mb-6 sm:mb-8 animate-fade-in">
          <h2 className="text-xl sm:text-2xl font-medium text-foreground mb-2">{t.dashboard.title}</h2>
          <p className="text-muted-foreground">{t.dashboard.subtitle}</p>
        </div>

        {/* Status Cards */}
        <StatusCards scanData={scanData} />

        {/* Action Panel */}
        <div className="bg-card rounded-lg shadow-sm border border-border mb-6 sm:mb-8 animate-fade-in">
          <div className="px-4 sm:px-6 py-4 border-b border-border">
            <h3 className="text-lg font-medium text-foreground">{t.dashboard.quickActions}</h3>
          </div>
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button 
                onClick={handleQuickScan}
                className={`btn-primary flex items-center justify-center px-4 py-3 transition-all duration-300 ${
                  isScanning 
                    ? 'cursor-not-allowed opacity-50' 
                    : 'hover:scale-105 animate-glow'
                }`}
                disabled={isScanning}
              >
                <WashingMachine className={`mr-2 ${isScanning ? 'animate-spin' : ''}`} />
                {isScanning ? t.dashboard.aiProcessing : t.dashboard.quickScan}
              </Button>
              
              <Button 
                onClick={handleFullScan}
                className={`btn-secondary flex items-center justify-center px-4 py-3 transition-all duration-300 ${
                  isScanning 
                    ? 'cursor-not-allowed opacity-50' 
                    : 'hover:scale-105 animate-glow'
                }`}
                disabled={isScanning}
              >
                <Folder className="mr-2" />
                {t.dashboard.fullScan}
              </Button>
              
              <Button 
                onClick={handleRefresh}
                className={`btn-success flex items-center justify-center px-4 py-3 transition-all duration-300 ${
                  !currentScanId 
                    ? 'cursor-not-allowed opacity-50' 
                    : 'hover:scale-105 animate-glow'
                }`}
                disabled={!currentScanId}
              >
                <UserRound className="mr-2" />
                {t.dashboard.refreshResults}
              </Button>
              
              <Button 
                onClick={handleProcessUnsubscribes}
                className={`btn-warning flex items-center justify-center px-4 py-3 transition-all duration-300 ${
                  !scanData?.emails?.some((email: any) => email.isSelected && email.hasUnsubscribeLink)
                    ? 'cursor-not-allowed opacity-50' 
                    : 'hover:scale-105 animate-glow'
                }`}
                disabled={!scanData?.emails?.some((email: any) => email.isSelected && email.hasUnsubscribeLink)}
              >
                <LogOut className="mr-2" />
                {t.dashboard.processUnsubscribes}
              </Button>
            </div>
          </div>
        </div>

        {/* Email Review Table */}
        {scanData && scanData.scan && scanData.scan.status === "processing" && (
          <div className="bg-card rounded-lg shadow-sm border border-border p-6 sm:p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <h3 className="text-lg font-medium text-foreground mb-2">{t.dashboard.aiProcessingEmails}</h3>
            <p className="text-muted-foreground">{t.dashboard.analyzingEmails.replace('{count}', scanData.scan.totalScanned.toString())}</p>
          </div>
        )}
        
        {scanData && scanData.scan && scanData.scan.status === "completed" && (
          <>
            {scanData.emails && scanData.emails.length > 0 ? (
              <EmailReviewTable 
                scanData={scanData} 
                onPreviewEmail={setPreviewEmailId}
                onRefresh={handleRefresh}
              />
            ) : (
              <div className="bg-card rounded-lg shadow-sm border border-border p-6 sm:p-8 text-center">
                <h3 className="text-lg font-medium text-foreground mb-2">{t.dashboard.greatNews}</h3>
                <p className="text-muted-foreground">{t.dashboard.noSpamDetected.replace('{count}', scanData.scan.totalScanned.toString())}</p>
              </div>
            )}
          </>
        )}

        {/* Default state when no scan data */}
        {!scanData && !isScanning && !latestScanLoading && (
          <div className="bg-card rounded-lg shadow-sm border border-border p-6 sm:p-8 text-center">
            <h3 className="text-lg font-medium text-foreground mb-2">{t.dashboard.welcome}</h3>
            <p className="text-muted-foreground mb-4">{t.dashboard.welcomeMessage}</p>
            <Button 
              onClick={handleQuickScan}
              className="btn-primary flex items-center justify-center"
            >
              <WashingMachine className="mr-2" />
              {t.dashboard.startFirstScan}
            </Button>
          </div>
        )}

        {/* Modals */}
        <ProcessingModal 
          isOpen={isProcessingModalOpen}
          onClose={() => setIsProcessingModalOpen(false)}
          emailCount={scanData?.emails?.filter((email: any) => email.isSelected && email.hasUnsubscribeLink)?.length || 0}
          scanId={currentScanId}
        />

        <AIProgressModal 
          isOpen={isAIProgressModalOpen}
          onClose={handleAIProgressClose}
          scanId={currentScanId}
          onComplete={handleAIProgressComplete}
        />

        <EmailPreviewModal 
          emailId={previewEmailId}
          isOpen={!!previewEmailId}
          onClose={() => setPreviewEmailId(null)}
        />

        <FolderSelectionModal 
          isOpen={isFolderSelectionOpen}
          onClose={() => setIsFolderSelectionOpen(false)}
          onConfirm={handleFolderSelection}
          provider={user?.provider || 'gmail'}
          isLoading={isScanning}
        />
      </div>
      
      <Footer />
    </div>
  );
}
