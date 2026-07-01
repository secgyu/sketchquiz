import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Clock, Eye, Hash, LogIn, Plus, RefreshCw, Search, Users, Zap } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLobbyStore, type PublicRoom, type RoomStatus } from "@/store/lobbyStore";

type FilterKey = "all" | "waiting" | "playing" | "open";
type SortKey = "recent" | "population";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "waiting", label: "대기중" },
  { key: "playing", label: "게임중" },
  { key: "open", label: "빈자리" },
];

const SORTS: { key: SortKey; label: string; icon: typeof Clock }[] = [
  { key: "recent", label: "최신순", icon: Clock },
  { key: "population", label: "인원순", icon: Users },
];

function matchesFilter(room: PublicRoom, filter: FilterKey): boolean {
  if (filter === "waiting") return room.status === "waiting";
  if (filter === "playing") return room.status === "playing";
  if (filter === "open") return room.count < room.max;
  return true;
}

const STATUS_STYLE: Record<RoomStatus, { label: string; dot: string; badge: string }> = {
  waiting: { label: "대기중", dot: "bg-brand-green", badge: "bg-brand-green" },
  playing: { label: "게임중", dot: "bg-brand-orange", badge: "bg-brand-yellow" },
};

/** 정원 대비 현재 인원을 점으로 시각화 (최대 10칸까지) */
function SlotDots({ count, max }: { count: number; max: number }) {
  const shown = Math.min(max, 10);
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: shown }).map((_, i) => (
        <span key={i} className={cn("size-2 rounded-full border border-ink", i < count ? "bg-ink" : "bg-white")} />
      ))}
    </div>
  );
}

function RoomCard({ room, index, onJoin }: { room: PublicRoom; index: number; onJoin: (room: PublicRoom) => void }) {
  const status = STATUS_STYLE[room.status];
  const full = room.count >= room.max;
  const joinable = room.status === "waiting" && !full;

  return (
    <li
      className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-3 rounded-2xl border-[3px] border-ink bg-white p-4 shadow-hard duration-300"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 text-base leading-tight font-black text-ink">{room.name}</h3>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-lg border-2 border-ink px-2 py-1 text-xs font-black text-ink",
            status.badge,
          )}
        >
          <span className={cn("size-2 rounded-full", status.dot, room.status === "waiting" && "animate-pulse")} />
          {status.label}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Avatar nickname={room.host} size="sm" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-muted-foreground">방장</p>
          <p className="truncate text-sm font-extrabold text-ink">{room.host}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-xl border-2 border-ink bg-brand-yellow/40 px-3 py-2">
        <span className="flex items-center gap-1 text-xs font-black text-ink">
          <Hash className="size-3.5" strokeWidth={2.5} />
          {room.round}라운드
        </span>
        <div className="flex items-center gap-2">
          <SlotDots count={room.count} max={room.max} />
          <span className="flex items-center gap-1 text-sm font-black text-ink tabular-nums">
            <Users className="size-4" strokeWidth={2.5} />
            {room.count}/{room.max}
          </span>
        </div>
      </div>

      <Button
        variant={joinable ? "blue" : "default"}
        size="sm"
        className="w-full"
        disabled={full && room.status === "waiting"}
        onClick={() => onJoin(room)}
      >
        {joinable ? (
          <>
            <LogIn strokeWidth={2.5} />
            입장
          </>
        ) : full && room.status === "waiting" ? (
          "가득 참"
        ) : (
          <>
            <Eye strokeWidth={2.5} />
            관전
          </>
        )}
      </Button>
    </li>
  );
}

export function RoomBrowserScreen() {
  const navigate = useNavigate();
  const rooms = useLobbyStore((s) => s.rooms);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rooms.filter((room) => {
      if (!matchesFilter(room, filter)) return false;
      if (!q) return true;
      return room.name.toLowerCase().includes(q) || room.host.toLowerCase().includes(q);
    });
    return [...list].sort((a, b) =>
      sort === "population" ? b.count - a.count || b.createdAt - a.createdAt : b.createdAt - a.createdAt,
    );
  }, [rooms, query, filter, sort]);

  // 빠른 입장: 대기중이면서 여석 있는 방 중 가장 찬 방부터 채워 게임 성사 확률을 높인다.
  const quickJoinRoom = useMemo(() => {
    const candidates = rooms.filter((r) => r.status === "waiting" && r.count < r.max);
    if (candidates.length === 0) return null;
    return [...candidates].sort((a, b) => b.count - a.count)[0];
  }, [rooms]);

  const handleRefresh = () => {
    // ponytail: 백엔드 연동 전이라 실제 갱신은 없고 시각 피드백만 준다.
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleJoin = (room: PublicRoom) => navigate(`/room/${room.code}`);
  const handleQuickJoin = () => quickJoinRoom && navigate(`/room/${quickJoinRoom.code}`);

  return (
    <div className="brutal-bg min-h-svh p-4">
      <div className="mx-auto flex max-w-5xl flex-col gap-5 py-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/")}
              aria-label="뒤로"
              className="press flex size-11 items-center justify-center rounded-xl border-[3px] border-ink bg-white text-ink"
            >
              <ArrowLeft strokeWidth={2.5} />
            </button>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-ink">공개방</h1>
              <p className="text-sm font-bold text-muted-foreground">
                열려 있는 방 <span className="text-ink">{rooms.length}</span>개 · 골라서 바로 입장!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              aria-label="새로고침"
              className="press flex size-11 items-center justify-center rounded-xl border-[3px] border-ink bg-white text-ink"
            >
              <RefreshCw className={cn("size-5", refreshing && "animate-spin")} strokeWidth={2.5} />
            </button>
            <Button variant="green" size="lg" onClick={handleQuickJoin} disabled={!quickJoinRoom}>
              <Zap strokeWidth={2.5} />
              빠른 입장
            </Button>
            <Button variant="pink" size="lg" className="text-white" onClick={() => navigate("/create")}>
              <Plus strokeWidth={2.5} />새 공개방 만들기
            </Button>
          </div>
        </header>

        <div className="flex flex-col gap-3 rounded-2xl border-[3px] border-ink bg-white p-3 shadow-hard sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={2.5}
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="방 이름 · 방장 검색"
              autoComplete="off"
              className="pl-9"
            />
          </div>
          <div className="flex gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "press rounded-lg border-2 border-ink px-3 py-2 text-sm font-black text-ink",
                  filter === f.key ? "bg-brand-blue" : "bg-white",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="hidden h-9 w-0.5 bg-ink sm:block" />

          <div className="flex gap-1.5">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                className={cn(
                  "press flex items-center gap-1.5 rounded-lg border-2 border-ink px-3 py-2 text-sm font-black text-ink",
                  sort === s.key ? "bg-brand-yellow" : "bg-white",
                )}
              >
                <s.icon className="size-4" strokeWidth={2.5} />
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((room, i) => (
              <RoomCard key={room.code} room={room} index={i} onJoin={handleJoin} />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-2xl border-[3px] border-dashed border-ink/40 bg-white/60 py-16 text-center">
            <span className="flex size-16 -rotate-6 items-center justify-center rounded-2xl border-[3px] border-ink bg-brand-yellow shadow-hard">
              <Search className="size-8 text-ink" strokeWidth={2.5} />
            </span>
            <div>
              <p className="text-lg font-black text-ink">조건에 맞는 방이 없어요</p>
              <p className="text-sm font-bold text-muted-foreground">검색어를 바꾸거나 새 공개방을 만들어보세요!</p>
            </div>
            <Button variant="green" size="lg" onClick={() => navigate("/create")}>
              <Plus strokeWidth={2.5} />새 공개방 만들기
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
