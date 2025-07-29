"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus, ArrowLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth.store";
import { searchUserByUsername, addFriend, getFriendshipStatus } from "@/features/friends/api";
import type { SearchResult } from "@/features/friends/types";
import { toast } from "@/hooks/use-toast";
import { friendToasts } from "@/lib/toasts";

export default function AddFriendPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingFriendIds, setAddingFriendIds] = useState<Set<string>>(
    new Set()
  );

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchUserByUsername(searchQuery);
      // 자신은 검색 결과에서 제외
      const filteredResults = results.filter(
        (result) => result.user.id !== profile?.id
      );

      // 각 사용자의 친구 관계 상태 확인
      const resultsWithStatus = await Promise.all(
        filteredResults.map(async (result) => {
          if (!profile) return result;
          
          const friendshipStatus = await getFriendshipStatus(
            profile.id,
            result.user.id
          );
          
          return {
            ...result,
            friendship_status: friendshipStatus,
          };
        })
      );

      setSearchResults(resultsWithStatus);
    } catch (error) {
      console.error("검색 실패:", error);
      toast({
        title: "검색 실패",
        description: "사용자 검색 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFriend = async (userId: string) => {
    if (!profile) return;

    setAddingFriendIds((prev) => new Set(prev).add(userId));
    try {
      await addFriend({ friend_id: userId }, profile.id);

      // 친구 이름 찾기
      const friendName =
        searchResults.find((r) => r.user.id === userId)?.user.display_name ||
        "친구";
      friendToasts.addSuccess(friendName);

      // 검색 결과 업데이트 (상태 변경)
      setSearchResults((prev) =>
        prev.map((result) =>
          result.user.id === userId
            ? { ...result, friendship_status: "pending" }
            : result
        )
      );
    } catch (error) {
      console.error("친구 추가 실패:", error);
      friendToasts.addError();
    } finally {
      setAddingFriendIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const getStatusBadge = (status: SearchResult["friendship_status"]) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">요청됨</Badge>;
      case "accepted":
        return <Badge variant="default">친구</Badge>;
      case "blocked":
        return <Badge variant="destructive">차단됨</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="p-2"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">친구 추가</h1>
            <p className="text-gray-600">ID로 친구를 찾아보세요</p>
          </div>
        </div>

        {/* 검색 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search size={20} />
              사용자 검색
            </CardTitle>
            <CardDescription>
              사용자명 또는 표시 이름으로 검색하세요
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="예: alice, 앨리스"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
              />
              <Button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                size="default"
              >
                {isSearching ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Search size={16} />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 검색 결과 */}
        {searchResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users size={20} />
                검색 결과 ({searchResults.length}명)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {searchResults.map((result) => (
                <div
                  key={result.user.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors"
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage
                      src={result.user.avatar_url || ""}
                      alt={result.user.display_name}
                    />
                    <AvatarFallback>
                      {result.user.display_name[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {result.user.display_name}
                      </h3>
                      {getStatusBadge(result.friendship_status)}
                      {result.is_mutual && (
                        <Badge variant="outline">맞팔</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      @{result.user.username}
                    </p>
                  </div>

                  <LoadingButton
                    size="sm"
                    onClick={() => handleAddFriend(result.user.id)}
                    disabled={result.friendship_status !== "none"}
                    loading={addingFriendIds.has(result.user.id)}
                    loadingText="추가 중..."
                    className="gap-1"
                  >
                    <UserPlus size={14} />
                    추가
                  </LoadingButton>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* 검색 결과 없음 */}
        {searchQuery.trim() && !isSearching && searchResults.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-4xl mb-4">🔍</div>
              <p className="text-gray-600 mb-2">검색 결과가 없습니다</p>
              <p className="text-sm text-gray-500">
                다른 사용자명으로 검색해보세요
              </p>
            </CardContent>
          </Card>
        )}

        {/* 검색 안내 */}
        {!searchQuery.trim() && (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="text-4xl mb-4">👥</div>
              <p className="text-gray-600 mb-2">친구를 찾아보세요</p>
              <p className="text-sm text-gray-500">
                사용자명을 입력하고 검색 버튼을 눌러보세요
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
