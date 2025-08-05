import { toast } from "@/hooks/use-toast";

export const showSuccessToast = (message: string, description?: string) => {
  toast({
    title: message,
    description,
    variant: "default",
    className: "border-green-500 bg-green-50 text-green-900",
  });
};

export const showErrorToast = (message: string, description?: string) => {
  toast({
    title: message,
    description,
    variant: "destructive",
  });
};

export const showWarningToast = (message: string, description?: string) => {
  toast({
    title: message,
    description,
    className: "border-yellow-500 bg-yellow-50 text-yellow-900",
  });
};

export const showInfoToast = (message: string, description?: string) => {
  toast({
    title: message,
    description,
    className: "border-blue-500 bg-blue-50 text-blue-900",
  });
};

// 특정 기능별 토스트 헬퍼
export const authToasts = {
  loginSuccess: () =>
    showSuccessToast("로그인 완료", "성공적으로 로그인되었습니다."),
  loginError: () => showErrorToast("로그인 실패", "다시 시도해주세요."),
  logoutSuccess: () =>
    showSuccessToast("로그아웃 완료", "안전하게 로그아웃되었습니다."),
};

export const friendToasts = {
  addSuccess: (friendName: string) =>
    showSuccessToast("친구 추가 완료", `${friendName}님과 친구가 되었습니다.`),
  addError: () =>
    showErrorToast(
      "친구 추가 실패",
      "네트워크 상태를 확인하고 다시 시도해주세요."
    ),
  updateSuccess: () =>
    showSuccessToast("친구 설정 변경", "친구 설정이 업데이트되었습니다."),
  updateError: () =>
    showErrorToast("설정 변경 실패", "친구 설정을 변경할 수 없습니다."),
};

export const messageToasts = {
  sendSuccess: () =>
    showSuccessToast("메시지 전송 완료", "메시지가 성공적으로 전송되었습니다."),
  sendError: () =>
    showErrorToast(
      "메시지 전송 실패",
      "네트워크 상태를 확인하고 다시 시도해주세요."
    ),
  receiveSuccess: () =>
    showInfoToast("새 메시지", "새로운 메시지가 도착했습니다."),
  printSuccess: () =>
    showSuccessToast("프린트 완료", "메시지가 성공적으로 출력되었습니다."),
  printError: () =>
    showErrorToast("프린트 실패", "프린터 연결 상태를 확인해주세요."),
};

export const printerToasts = {
  connectSuccess: (deviceName: string) =>
    showSuccessToast("프린터 연결 완료", `${deviceName}에 연결되었습니다.`),
  connectError: () =>
    showErrorToast(
      "프린터 연결 실패",
      "프린터 전원과 Bluetooth 상태를 확인해주세요."
    ),
  disconnectSuccess: () =>
    showInfoToast("프린터 연결 해제", "프린터 연결이 해제되었습니다."),
  printStarted: () => showInfoToast("프린트 시작", "출력이 시작되었습니다."),
  printCompleted: () =>
    showSuccessToast("프린트 완료", "출력이 완료되었습니다."),
  printError: () =>
    showErrorToast(
      "프린트 오류",
      "출력 중 오류가 발생했습니다. 다시 시도해주세요."
    ),
  lowBattery: () =>
    showWarningToast("배터리 부족", "프린터 배터리를 충전해주세요."),
  paperEmpty: () => showWarningToast("용지 부족", "감열지를 교체해주세요."),
};

export const imageToasts = {
  uploadSuccess: () =>
    showSuccessToast(
      "이미지 업로드 완료",
      "이미지가 성공적으로 업로드되었습니다."
    ),
  uploadError: () =>
    showErrorToast("이미지 업로드 실패", "이미지 크기나 형식을 확인해주세요."),
  processSuccess: () =>
    showSuccessToast("이미지 편집 완료", "편집된 이미지가 준비되었습니다."),
  processError: () =>
    showErrorToast("이미지 편집 실패", "이미지 처리 중 오류가 발생했습니다."),
};
