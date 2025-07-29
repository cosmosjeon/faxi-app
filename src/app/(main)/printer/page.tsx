"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bluetooth,
  BluetoothConnected,
  BluetoothSearching,
  Power,
  PowerOff,
  Battery,
  FileText,
  Image as ImageIcon,
  Printer,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Camera,
  Upload,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBlePrinter } from "@/hooks/useBlePrinter";
import { toast } from "@/hooks/use-toast";

export default function PrinterPage() {
  const router = useRouter();
  const printer = useBlePrinter();

  // 상태별 아이콘
  const getStatusIcon = () => {
    switch (printer.status) {
      case "connected":
        return <BluetoothConnected className="text-green-600" size={24} />;
      case "connecting":
        return (
          <BluetoothSearching
            className="text-blue-600 animate-spin"
            size={24}
          />
        );
      case "printing":
        return <Printer className="text-blue-600 animate-pulse" size={24} />;
      case "error":
        return <AlertTriangle className="text-red-600" size={24} />;
      default:
        return <Bluetooth className="text-gray-400" size={24} />;
    }
  };

  // 상태별 텍스트
  const getStatusText = () => {
    switch (printer.status) {
      case "connected":
        return "연결됨";
      case "connecting":
        return "연결 중...";
      case "printing":
        return "프린트 중...";
      case "error":
        return "오류";
      default:
        return "연결 안됨";
    }
  };

  // 상태별 색상
  const getStatusColor = () => {
    switch (printer.status) {
      case "connected":
        return "text-green-600";
      case "connecting":
      case "printing":
        return "text-blue-600";
      case "error":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  // 배터리 상태 색상
  const getBatteryColor = (level?: number) => {
    if (!level) return "bg-gray-300";
    if (level > 50) return "bg-green-500";
    if (level > 20) return "bg-yellow-500";
    return "bg-red-500";
  };

  // 용지 상태 뱃지
  const getPaperStatusBadge = (status?: string) => {
    switch (status) {
      case "ok":
        return (
          <Badge variant="outline" className="text-green-600">
            용지 정상
          </Badge>
        );
      case "low":
        return (
          <Badge variant="outline" className="text-yellow-600">
            용지 부족
          </Badge>
        );
      case "empty":
        return <Badge variant="destructive">용지 없음</Badge>;
      default:
        return <Badge variant="secondary">상태 확인 중</Badge>;
    }
  };

  // 프린트 작업 상태 아이콘
  const getJobStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="text-green-600" size={16} />;
      case "failed":
        return <XCircle className="text-red-600" size={16} />;
      case "processing":
        return <Printer className="text-blue-600 animate-pulse" size={16} />;
      default:
        return <Clock className="text-gray-400" size={16} />;
    }
  };

  // 개인 사진 편집 페이지로 이동
  const handlePersonalPhotoEdit = () => {
    if (!printer.isConnected) {
      toast({
        title: "프린터 연결 필요",
        description: "먼저 프린터를 연결해주세요.",
        variant: "destructive",
      });
      return;
    }
    router.push("/printer/photo-edit");
  };

  // 테스트 프린트
  const handleTestPrint = async () => {
    try {
      await printer.printText(
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `         🧪 TEST PRINT\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `안녕하세요! Studio Pensieve입니다.\n\n` +
          `이것은 프린터 연결 테스트용 출력물입니다.\n` +
          `프린터가 정상적으로 작동하고 있습니다.\n\n` +
          `TIME: ${new Date().toLocaleString("ko-KR")}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `      🖨️ Studio Pensieve\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      );
    } catch (error) {
      console.error("테스트 프린트 실패:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* 헤더 */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            프린터 관리 🖨️
          </h1>
          <p className="text-gray-600">BLE 프린터를 연결하고 관리하세요</p>
        </div>

        {/* BLE 지원 여부 */}
        {!printer.isSupported && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle size={20} />
                <div>
                  <p className="font-medium">Web Bluetooth 미지원</p>
                  <p className="text-sm text-red-600">
                    Chrome 브라우저를 사용하거나 안드로이드 앱을 다운로드하세요.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 프린터 연결 상태 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>연결 상태</span>
              {getStatusIcon()}
            </CardTitle>
            <CardDescription>
              현재 프린터 연결 상태를 확인하세요
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">상태:</span>
              <span className={`text-sm font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </span>
            </div>

            {printer.connectedPrinter && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">프린터 이름:</span>
                    <span className="text-sm font-medium">
                      {printer.connectedPrinter.name}
                    </span>
                  </div>

                  {printer.connectedPrinter.batteryLevel && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm flex items-center gap-1">
                          <Battery size={14} />
                          배터리:
                        </span>
                        <span className="text-sm font-medium">
                          {printer.connectedPrinter.batteryLevel}%
                        </span>
                      </div>
                      <Progress
                        value={printer.connectedPrinter.batteryLevel}
                        className="h-2"
                      />
                    </div>
                  )}

                  {printer.connectedPrinter.paperStatus && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">용지 상태:</span>
                      {getPaperStatusBadge(
                        printer.connectedPrinter.paperStatus
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {printer.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{printer.error}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={printer.clearError}
                  className="mt-2"
                >
                  오류 지우기
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              {!printer.isConnected ? (
                <Button
                  onClick={printer.connect}
                  disabled={!printer.isSupported || printer.isConnecting}
                  className="flex-1"
                >
                  {printer.isConnecting ? (
                    <>
                      <BluetoothSearching
                        className="mr-2 animate-spin"
                        size={16}
                      />
                      연결 중...
                    </>
                  ) : (
                    <>
                      <Power className="mr-2" size={16} />
                      프린터 연결
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={printer.disconnect}
                  className="flex-1"
                >
                  <PowerOff className="mr-2" size={16} />
                  연결 해제
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 개발 모드 표시 */}
        {printer.isDevelopmentMode && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <div className="text-yellow-800">
                <p className="font-medium">🧪 개발 모드</p>
                <p className="text-sm">
                  Mock 프린터로 동작합니다. 실제 하드웨어는 연결되지 않습니다.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 프린트 큐 */}
        {printer.printQueue.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>프린트 작업</CardTitle>
              <CardDescription>현재 프린트 대기열을 확인하세요</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {printer.printQueue
                  .slice(-5)
                  .reverse()
                  .map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
                    >
                      {getJobStatusIcon(job.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {job.type === "text" && <FileText size={14} />}
                          {job.type === "image" && <ImageIcon size={14} />}
                          {job.type === "message" && <Printer size={14} />}
                          <span className="text-sm font-medium capitalize">
                            {job.type === "message"
                              ? "메시지"
                              : job.type === "text"
                              ? "텍스트"
                              : "이미지"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {new Date(job.createdAt).toLocaleString("ko-KR")}
                        </p>
                        {job.error && (
                          <p className="text-xs text-red-600">{job.error}</p>
                        )}
                      </div>
                      <Badge
                        variant={
                          job.status === "completed"
                            ? "outline"
                            : job.status === "failed"
                            ? "destructive"
                            : job.status === "processing"
                            ? "default"
                            : "secondary"
                        }
                        className="text-xs"
                      >
                        {job.status === "pending"
                          ? "대기"
                          : job.status === "processing"
                          ? "처리중"
                          : job.status === "completed"
                          ? "완료"
                          : "실패"}
                      </Badge>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 기능 버튼들 */}
        <div className="grid grid-cols-2 gap-4">
          {/* 테스트 프린트 */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4 text-center">
              <Button
                variant="outline"
                onClick={handleTestPrint}
                disabled={!printer.isConnected}
                className="w-full h-auto flex-col gap-2"
              >
                <FileText size={24} />
                <span className="text-sm">테스트 프린트</span>
              </Button>
            </CardContent>
          </Card>

          {/* 개인 사진 프린트 */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4 text-center">
              <Button
                variant="outline"
                onClick={handlePersonalPhotoEdit}
                disabled={!printer.isConnected}
                className="w-full h-auto flex-col gap-2"
              >
                <Camera size={24} />
                <span className="text-sm">개인 사진 프린트</span>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Mock 기기 선택 Dialog */}
        <Dialog
          open={printer.showDeviceSelection}
          onOpenChange={(open) => {
            if (!open) {
              printer.cancelDeviceSelection();
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BluetoothSearching size={20} />
                프린터 선택
              </DialogTitle>
              <DialogDescription>연결할 프린터를 선택하세요</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {printer.availableDevices.map((device) => (
                <div
                  key={device.id}
                  onClick={() => printer.selectMockDevice(device)}
                  className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{device.name}</p>
                      <p className="text-sm text-gray-500">{device.id}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="flex items-center gap-1">
                        <Battery size={12} />
                        <span className="text-sm">{device.batteryLevel}%</span>
                      </div>
                      {getPaperStatusBadge(device.paperStatus)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={printer.cancelDeviceSelection}>
                취소
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
