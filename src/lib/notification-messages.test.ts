import { createNotificationMessage, validateMessageLength, adjustMessageLength } from './notification-messages';
import type { NotificationEventType, NotificationPayload } from './notification-messages';

describe('createNotificationMessage', () => {
  describe('NEW_PRINT 이벤트', () => {
    it('정상적인 티저와 발신자 이름으로 메시지를 생성한다', () => {
      const payload: NotificationPayload = {
        teaser: '안녕하세요',
        senderName: '김철수'
      };

      const result = createNotificationMessage('NEW_PRINT', payload);

      expect(result.title).toBe('새로운 프린트 도착!');
      expect(result.body).toBe('"안녕하세요" from 김철수');
      expect(result.badge).toBe(1);
      expect(result.sound).toBe('default');
    });

    it('긴 티저 메시지를 자동으로 자른다', () => {
      const payload: NotificationPayload = {
        teaser: '매우 긴 티저 메시지입니다 이것은 테스트용입니다',
        senderName: '김철수'
      };

      const result = createNotificationMessage('NEW_PRINT', payload);

      expect(result.body).toBe('"매우 긴 티저..." from 김철수');
    });

    it('긴 발신자 이름을 자동으로 자른다', () => {
      const payload: NotificationPayload = {
        teaser: '안녕',
        senderName: '매우긴발신자이름입니다테스트용입니다'
      };

      const result = createNotificationMessage('NEW_PRINT', payload);

      expect(result.body).toBe('"안녕" from 매우긴발신자이름...');
    });

    it('빈 티저와 발신자 이름에 기본값을 사용한다', () => {
      const payload: NotificationPayload = {};

      const result = createNotificationMessage('NEW_PRINT', payload);

      expect(result.body).toBe('"새 메시지" from 알 수 없는 사용자');
    });
  });

  describe('FRIEND_REQUEST 이벤트', () => {
    it('친구 요청 메시지를 생성한다', () => {
      const payload: NotificationPayload = {
        requesterName: '박영희',
        requesterId: 'user-123'
      };

      const result = createNotificationMessage('FRIEND_REQUEST', payload);

      expect(result.title).toBe('새로운 친구 요청');
      expect(result.body).toBe('박영희님이 친구가 되고 싶어해요.');
      expect(result.badge).toBe(1);
    });

    it('빈 요청자 이름에 기본값을 사용한다', () => {
      const payload: NotificationPayload = {};

      const result = createNotificationMessage('FRIEND_REQUEST', payload);

      expect(result.body).toBe('알 수 없는 사용자님이 친구가 되고 싶어해요.');
    });
  });

  describe('FRIEND_ACCEPT 이벤트', () => {
    it('친구 수락 메시지를 생성한다', () => {
      const payload: NotificationPayload = {
        senderName: '이민수',
        senderId: 'user-456'
      };

      const result = createNotificationMessage('FRIEND_ACCEPT', payload);

      expect(result.title).toBe('친구 수락');
      expect(result.body).toBe('이민수님과 친구가 되었어요.');
      expect(result.badge).toBe(1);
    });
  });

  describe('PRINTER_CONNECTED 이벤트', () => {
    it('프린터 이름이 있을 때 메시지를 생성한다', () => {
      const payload: NotificationPayload = {
        printerName: 'HP 프린터'
      };

      const result = createNotificationMessage('PRINTER_CONNECTED', payload);

      expect(result.title).toBe('프린터 연결됨');
      expect(result.body).toBe('"HP 프린터"와 연결되었습니다.');
      expect(result.badge).toBe(0);
    });

    it('프린터 이름이 없을 때 기본값을 사용한다', () => {
      const payload: NotificationPayload = {};

      const result = createNotificationMessage('PRINTER_CONNECTED', payload);

      expect(result.body).toBe('프린터와 연결되었습니다.');
    });
  });

  describe('PRINTER_DISCONNECTED 이벤트', () => {
    it('프린터 연결 해제 메시지를 생성한다', () => {
      const payload: NotificationPayload = {};

      const result = createNotificationMessage('PRINTER_DISCONNECTED', payload);

      expect(result.title).toBe('프린터 연결 끊김');
      expect(result.body).toBe('프린터 연결이 끊어졌습니다. 다시 연결해주세요.');
      expect(result.badge).toBe(0);
    });
  });

  describe('PRINT_COMPLETED 이벤트', () => {
    it('프린트 완료 메시지를 생성한다', () => {
      const payload: NotificationPayload = {
        printId: 'print-123'
      };

      const result = createNotificationMessage('PRINT_COMPLETED', payload);

      expect(result.title).toBe('프린트 완료');
      expect(result.body).toBe('메시지가 성공적으로 프린트되었습니다.');
      expect(result.badge).toBe(0);
    });
  });

  describe('PRINT_ERROR 이벤트', () => {
    it('오류 메시지가 있을 때 프린트 오류 메시지를 생성한다', () => {
      const payload: NotificationPayload = {
        errorMessage: '용지가 부족합니다',
        printId: 'print-456'
      };

      const result = createNotificationMessage('PRINT_ERROR', payload);

      expect(result.title).toBe('프린트 오류');
      expect(result.body).toBe('프린트 중 오류가 발생했습니다: 용지가 부족합니다');
      expect(result.badge).toBe(0);
    });

    it('오류 메시지가 없을 때 기본값을 사용한다', () => {
      const payload: NotificationPayload = {};

      const result = createNotificationMessage('PRINT_ERROR', payload);

      expect(result.body).toBe('프린트 중 오류가 발생했습니다: 알 수 없는 오류');
    });
  });

  describe('알 수 없는 이벤트 타입', () => {
    it('기본 메시지를 생성한다', () => {
      const payload: NotificationPayload = {};

      const result = createNotificationMessage('UNKNOWN_EVENT' as NotificationEventType, payload);

      expect(result.title).toBe('새 알림');
      expect(result.body).toBe('새로운 알림이 도착했습니다.');
      expect(result.badge).toBe(1);
    });
  });
});

describe('validateMessageLength', () => {
  it('정상적인 길이의 메시지를 검증한다', () => {
    const message = {
      title: '정상 제목',
      body: '정상 본문'
    };

    expect(validateMessageLength(message)).toBe(true);
  });

  it('긴 제목을 감지한다', () => {
    const message = {
      title: '매우 긴 제목입니다 이것은 테스트용입니다 길이를 초과합니다',
      body: '정상 본문'
    };

    expect(validateMessageLength(message)).toBe(false);
  });

  it('긴 본문을 감지한다', () => {
    const message = {
      title: '정상 제목',
      body: '매우 긴 본문입니다 이것은 테스트용입니다 길이를 초과합니다 매우 긴 본문입니다 이것은 테스트용입니다 길이를 초과합니다'
    };

    expect(validateMessageLength(message)).toBe(false);
  });
});

describe('adjustMessageLength', () => {
  it('긴 메시지를 자동으로 자른다', () => {
    const message = {
      title: '매우 긴 제목입니다 이것은 테스트용입니다',
      body: '매우 긴 본문입니다 이것은 테스트용입니다',
      badge: 1
    };

    const result = adjustMessageLength(message);

    expect(result.title).toBe('매우 긴 제목입니다 이것은 테스트용...');
    expect(result.body).toBe('매우 긴 본문입니다 이것은 테스트용...');
    expect(result.badge).toBe(1);
  });

  it('정상적인 길이의 메시지는 변경하지 않는다', () => {
    const message = {
      title: '정상 제목',
      body: '정상 본문',
      badge: 1
    };

    const result = adjustMessageLength(message);

    expect(result).toEqual(message);
  });
}); 