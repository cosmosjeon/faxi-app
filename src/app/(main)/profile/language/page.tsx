"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/stores/auth.store";
import { useToast } from "@/hooks/use-toast";
import { getUserSettings, updateUserSettings } from "@/features/settings/api";
import { useTranslation } from "@/lib/i18n/LanguageProvider";

export default function LanguageSettingsPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { toast } = useToast();
  const { language, setLanguage, t } = useTranslation();

  const [value, setValue] = useState<"ko" | "en">(language);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        if (!profile?.id) return;
        const settings = await getUserSettings(profile.id);
        const serverLang = (settings as any)?.language as "ko" | "en" | undefined;
        if (serverLang === "ko" || serverLang === "en") {
          setValue(serverLang);
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [profile?.id]);

  const handleSave = async () => {
    if (!profile?.id) return;
    setIsSaving(true);
    try {
      // 전역과 로컬/서버 모두 저장
      setLanguage(value);
      await updateUserSettings(profile.id, { language: value });
      toast({ title: t("language.saved") });
      router.back();
    } catch (e) {
      toast({ title: "Failed", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* 헤더 */}
        <div className="bg-white rounded-lg px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="p-2"
            >
              <ArrowLeft size={20} />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 leading-tight">{t("language.title")}</h1>
              <p className="text-sm text-gray-600 mt-0.5">{t("language.subtitle")}</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("language.field")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("language.field")}</Label>
              <Select value={value} onValueChange={(v: "ko" | "en") => setValue(v)} disabled={isSaving}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ko">{t("language.korean")}</SelectItem>
                  <SelectItem value="en">{t("language.english")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={isSaving}>
                {t("common.save")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


