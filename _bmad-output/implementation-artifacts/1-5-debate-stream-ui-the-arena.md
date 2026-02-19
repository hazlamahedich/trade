# Story 1.5: Debate Stream UI (The Arena)

Status: done

## Story

As a User,
I want to view the debate in a chat-like interface,
So that I can easily follow the conversation.

## Acceptance Criteria

1. **Given** the WebSocket stream **When** messages arrive **Then** they are displayed in a chat list (Bull on left/green, Bear on right/red) ✅

2. **Given** an incomplete message **When** streaming is in progress **Then** "Active Waiting" indicators (typing...) are shown to the user ✅

3. **Given** the UI **When** viewed in Portrait mode on mobile **Then** the chat is fully visible, readable, and scrollable (Thumb Zone compliant) ✅

## Tasks / Subtasks

- [x] Create DebateStream component (AC: #1, #2, #3)
  - [x] Create `nextjs-frontend/features/debate/components/DebateStream.tsx`
  - [x] Create `nextjs-frontend/features/debate/components/ArgumentBubble.tsx`
  - [x] Create `nextjs-frontend/features/debate/components/TypingIndicator.tsx`
  - [x] Implement virtualized message list with `@tanstack/react-virtual`
  - [x] Add auto-scroll with user scroll detection

- [x] Build agent persona styling (AC: #1)
  - [x] Style Bull agent: left-aligned, emerald/green theme
  - [x] Style Bear agent: right-aligned, rose/red theme
  - [x] Add agent avatars and visual distinction

- [x] Implement Active Waiting states (AC: #2)
  - [x] Create typing indicator with CSS animation
  - [x] Show "Agent is thinking..." during LLM generation
  - [x] Handle TOKEN_RECEIVED vs ARGUMENT_COMPLETE transitions

- [x] Connect to WebSocket streaming (AC: #1, #2)
  - [x] Integrate `useDebateSocket` hook from Story 1-4
  - [x] Handle DEBATE/TOKEN_RECEIVED for streaming text
  - [x] Handle DEBATE/ARGUMENT_COMPLETE for final messages
  - [x] Handle DEBATE/STATUS_UPDATE for state changes

- [x] Mobile-first responsive layout (AC: #3)
  - [x] Portrait mode optimization
  - [x] Thumb Zone navigation (bottom 30% for actions)
  - [x] Readable text (16px minimum)
  - [x] Smooth scrolling performance

- [x] Write tests
  - [x] Unit tests for ArgumentBubble component
  - [x] Unit tests for TypingIndicator component
  - [x] E2E tests for DebateStream component
  - [x] Accessibility tests (WCAG AA)

## Dev Notes

### 🚨 CRITICAL: Use Existing WebSocket Infrastructure

**Story 1-4 already implemented the WebSocket layer - DO NOT RECREATE:**

| Existing Component | Location | Use For |
|-------------------|----------|---------|
| `useDebateSocket` | `features/debate/hooks/useDebateSocket.ts` | WebSocket connection |
| WebSocket Actions | Backend `ws_schemas.py` | Message types |
| Connection Manager | Backend `streaming.py` | Broadcasting |

**Import the existing hook:**
```typescript
import { useDebateSocket } from '../hooks/useDebateSocket';
```

### 🚨 CRITICAL: Virtualization Required

**UX Specification mandates virtualization for performance:**

> "DebateStream requires virtualization for performance" - ux-design-specification.md

**Use `@tanstack/react-virtual`:**
```bash
npm install @tanstack/react-virtual
```

**Why virtualization:**
- Debates can have many messages
- Mobile performance critical
- Prevents DOM bloat

### 🚨 CRITICAL: Mobile-First Portrait Layout

**UX Specification requirements:**

- **Portrait Mode optimization** with "Thumb Zone" navigation (Bottom 30%)
- **16px minimum text** for readability
- **Single column layout** on mobile (< 768px)
- **DOM ordering**: DebateStream must be first for screen readers

### 🚨 CRITICAL: Agent Visual Distinction

**Color system from UX Specification:**

| Agent | Color | Position | Glow |
|-------|-------|----------|------|
| Bull | `emerald-500` | Left | `shadow-emerald-500/20` |
| Bear | `rose-500` | Right | `shadow-rose-500/20` |

**Accessibility - Dual-Coding Required:**
- NEVER use color alone to convey information
- Add icons (ArrowUp for Bull, ArrowDown for Bear)
- Add text labels ("Bullish", "Bearish")

### 🚨 CRITICAL: Animation with Framer Motion

**Use Framer Motion for micro-interactions:**

```typescript
import { motion, AnimatePresence } from 'framer-motion';

// Message slide-up animation
const messageVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

// Motion safety - respect prefers-reduced-motion
const shouldReduceMotion = useReducedMotion();
```

### 🚨 CRITICAL: Active Waiting (Typing Indicator)

**UX Principle: "Latency is Drama"**

Turn processing time into anticipation:
- Show typing indicator during TOKEN_RECEIVED streaming
- Use animated dots or "Agent is analyzing..." text
- Framer Motion for smooth transitions

**Implementation:**
```typescript
// In DebateStream.tsx
const [isStreaming, setIsStreaming] = useState(false);
const [currentAgent, setCurrentAgent] = useState<string | null>(null);

// From useDebateSocket callback
const handleTokenReceived = useCallback((payload: TokenPayload) => {
  setIsStreaming(true);
  setCurrentAgent(payload.agent);
  // Append token to current message buffer
}, []);

const handleArgumentComplete = useCallback((payload: ArgumentPayload) => {
  setIsStreaming(false);
  setCurrentAgent(null);
  // Finalize message and add to list
}, []);
```

### 🚨 CRITICAL: WebSocket Action Types (From Story 1-4)

**Handle these action types in UI:**

| Action | When | UI Response |
|--------|------|-------------|
| `DEBATE/TOKEN_RECEIVED` | LLM generates token | Update streaming message |
| `DEBATE/ARGUMENT_COMPLETE` | Agent finishes | Finalize message, stop typing |
| `DEBATE/TURN_CHANGE` | Agent switch | Show new typing indicator |
| `DEBATE/STATUS_UPDATE` | Debate status | Show/hide UI elements |
| `DEBATE/ERROR` | Error occurs | Show error toast |
| `DEBATE/CONNECTED` | Connection ready | Enable UI |

### File Structure

```
trade-app/nextjs-frontend/src/features/debate/
├── components/
│   ├── DebateStream.tsx        # NEW: Main container
│   ├── ArgumentBubble.tsx      # NEW: Individual message
│   ├── TypingIndicator.tsx     # NEW: Active waiting UI
│   └── AgentAvatar.tsx         # NEW: Agent icons
├── hooks/
│   ├── useDebateSocket.ts      # EXISTS (Story 1-4)
│   └── index.ts                # EXISTS (Story 1-4)
└── types.ts                    # NEW: Component types
```

### Component Architecture

**DebateStream.tsx:**
```typescript
interface DebateStreamProps {
  debateId: string;
}

export function DebateStream({ debateId }: DebateStreamProps) {
  const [messages, setMessages] = useState<Argument[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<AgentType | null>(null);
  
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Virtualization
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });
  
  // WebSocket connection
  const { status } = useDebateSocket({
    debateId,
    onTokenReceived: (payload) => {
      setIsStreaming(true);
      setCurrentAgent(payload.agent);
      setStreamingText(prev => prev + payload.token);
    },
    onArgumentComplete: (payload) => {
      setMessages(prev => [...prev, {
        id: generateId(),
        agent: payload.agent,
        content: payload.content,
        timestamp: new Date().toISOString(),
      }]);
      setStreamingText('');
      setIsStreaming(false);
      setCurrentAgent(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  // Auto-scroll logic
  // User scroll detection
  // Render virtualized list
}
```

**ArgumentBubble.tsx:**
```typescript
interface ArgumentBubbleProps {
  agent: 'bull' | 'bear';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
}

export function ArgumentBubble({ agent, content, timestamp, isStreaming }: ArgumentBubbleProps) {
  const isBull = agent === 'bull';
  
  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        "flex gap-3 p-4 rounded-lg",
        isBull ? "flex-row" : "flex-row-reverse",
        isBull ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"
      )}
    >
      <AgentAvatar agent={agent} />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn(
            "font-semibold",
            isBull ? "text-emerald-500" : "text-rose-500"
          )}>
            {isBull ? "Bull" : "Bear"}
          </span>
          <span className="text-xs text-slate-500">{formatTime(timestamp)}</span>
        </div>
        <p className="text-slate-200 text-base leading-relaxed">{content}</p>
      </div>
    </motion.div>
  );
}
```

### Styling Patterns

**Dark Mode Default (from UX Spec):**
- Background: `bg-slate-900`
- Cards: `bg-slate-800/50 border-white/10`
- Text: `text-slate-200` (primary), `text-slate-400` (secondary)

**Agent-specific glow effects:**
```typescript
const agentGlowClass = {
  bull: "shadow-[0_0_20px_rgba(16,185,129,0.2)]",
  bear: "shadow-[0_0_20px_rgba(244,63,94,0.2)]",
};
```

### Accessibility Requirements (WCAG AA Strict)

1. **Dual-Coding for Color:**
   - Color + Icon + Text for all agent indicators
   - Use Lucide icons: `TrendingUp` for Bull, `TrendingDown` for Bear

2. **ARIA Live Region:**
   ```tsx
   <div role="log" aria-live="polite" aria-label="Debate messages">
     {/* DebateStream content */}
   </div>
   ```

3. **Motion Safety:**
   ```typescript
   const shouldReduceMotion = useReducedMotion();
   // Conditionally disable/reduce animations
   ```

4. **Focus Management:**
   - Auto-scroll should not steal focus
   - New messages announced via aria-live

### Testing Requirements

| Test | Description | Priority |
|------|-------------|----------|
| DebateStream renders | Component mounts without crash | P0 |
| Messages display correctly | Bull/Bear styling applied | P0 |
| Virtualization works | Large message lists performant | P0 |
| Typing indicator shows | During TOKEN_RECEIVED | P1 |
| Auto-scroll works | New messages visible | P1 |
| User scroll pauses auto-scroll | Scroll detection | P1 |
| Mobile layout correct | Portrait mode responsive | P1 |
| Accessibility passes | WCAG AA compliance | P1 |
| Animations respect reduced motion | Motion safety | P2 |

---

## Test Quality Review

**Review Date**: 2026-02-19
**Quality Score**: 82/100 (A - Good)
**Status**: ✅ Approved with Comments

### Test File Analysis

| File | Lines | Tests | P0 | P1 | P2 | P3 |
|------|-------|-------|----|----|----|----|
| `tests/e2e/debate-stream-ui.spec.ts` | 507 | 17 | 4 | 6 | 5 | 2 |

### Strengths ✅

1. **Comprehensive Accessibility Testing** - Tests for WCAG AA, aria-live regions, motion safety
2. **Mobile-First Testing** - Portrait layout, thumb zone compliance verified
3. **Performance Testing** - Virtualization with 1000 messages tested
4. **Network-First Pattern** - Proper `waitForResponse()` before assertions
5. **WebSocket Interceptor** - Excellent helper for testing real-time features

### Issues to Address ⚠️

1. **Hard Waits (P0)** - 7 instances of `waitForTimeout()` in debate-stream-ui.spec.ts
   - Lines: 48, 80, 177, 203, 237, 313, 375
   - **Fix**: Replace with `waitForFunction()` for WebSocket message conditions

2. **File Length (P1)** - Test file exceeds 300-line threshold (507 lines)
   - **Recommendation**: Split into focused files:
     - `debate-stream-rendering.spec.ts` (P0 tests)
     - `debate-stream-accessibility.spec.ts` (a11y tests)
     - `debate-stream-ux.spec.ts` (P1/P2 UX tests)

### Recommended Fix for Hard Waits

```typescript
// ❌ Current (line 48)
await page.waitForTimeout(5000);
const messages = await getWebSocketMessages(page);

// ✅ Better
await page.waitForFunction(
  () => (window as any).__WS_MESSAGES__?.some((m: any) => m.type === 'DEBATE/ARGUMENT_COMPLETE'),
  { timeout: 10000 }
);
const messages = await getWebSocketMessages(page);
```

### Test Coverage Summary

| Acceptance Criterion | Test ID | Status |
|---------------------|---------|--------|
| AC1: Chat list display | 1-5-E2E-001, 002, 003 | ✅ Covered |
| AC2: Active Waiting indicators | 1-5-E2E-004, 005 | ✅ Covered |
| AC3: Mobile portrait layout | 1-5-E2E-008, 012 | ✅ Covered |
| Accessibility (NFR) | 1-5-E2E-009, 010, 013, 014 | ✅ Covered |
| Performance (NFR) | 1-5-E2E-011 | ✅ Covered |

### Full Review Report

See: `_bmad-output/test-artifacts/test-review-1-5.md`

---

### Performance Targets (NFR-01)

| Metric | Target |
|--------|--------|
| Initial render | < 200ms |
| Message append | < 50ms |
| Virtual scroll FPS | 60fps |
| Memory (1000 messages) | < 50MB |

### Dependencies

**Already installed (from Story 1-1):**
- `framer-motion`
- `@radix-ui/react-scroll-area`
- `lucide-react`

**New installation:**
```bash
npm install @tanstack/react-virtual
```

### Previous Story Intelligence (Story 1-4)

**Build upon:**
- `useDebateSocket` hook with callbacks for all action types
- WebSocket action types: TOKEN_RECEIVED, ARGUMENT_COMPLETE, TURN_CHANGE
- Reconnection handled automatically
- Token refresh logic built-in

**Do NOT recreate:**
- WebSocket connection logic
- Action type definitions
- Authentication handling

**Testing patterns from 1-4:**
- Use `jest.runAllTimersAsync()` for async tests
- Mock WebSocket with predictable responses
- Test hook with `renderHook` from RTL

### References

- [Source: epics.md#Story 1.5 Acceptance Criteria]
- [Source: ux-design-specification.md#DebateStream Component]
- [Source: ux-design-specification.md#Active Waiting States]
- [Source: ux-design-specification.md#Mobile-First Portrait]
- [Source: ux-design-specification.md#Accessibility WCAG AA]
- [Source: ux-design-specification.md#Color System]
- [Source: architecture.md#Frontend Structure]
- [Source: architecture.md#Feature-Based Organization]
- [Source: project-context.md#TypeScript Strict Mode]
- [Source: project-context.md#State Management React Query/Zustand]
- [Source: NFR-01 (Stream Latency < 500ms)]
- [Source: FR-01 (Live debate streaming)]
- [Previous: 1-4-websocket-streaming-layer.md]

## Dev Agent Record

### Agent Model Used

zai-coding-plan/glm-5

### Debug Log References

N/A

### Completion Notes List

- Implemented all 4 components: DebateStream, ArgumentBubble, TypingIndicator, AgentAvatar
- Added jest.setup.ts for jest-dom matchers
- Fixed TypeScript errors in E2E test fixtures
- Installed @tanstack/react-virtual and framer-motion
- All 20 unit tests passing

### File List

**Components Created:**
- `trade-app/nextjs-frontend/features/debate/components/DebateStream.tsx` - Main container with virtualization
- `trade-app/nextjs-frontend/features/debate/components/ArgumentBubble.tsx` - Individual message display
- `trade-app/nextjs-frontend/features/debate/components/TypingIndicator.tsx` - Active waiting UI
- `trade-app/nextjs-frontend/features/debate/components/AgentAvatar.tsx` - Agent icons (Bull/Bear)
- `trade-app/nextjs-frontend/features/debate/components/index.ts` - Component exports

**Tests Modified:**
- `trade-app/nextjs-frontend/tests/unit/ArgumentBubble.test.tsx` - Fixed import path
- `trade-app/nextjs-frontend/tests/unit/TypingIndicator.test.tsx` - Fixed import path, aria-label test
- `trade-app/nextjs-frontend/tests/e2e/debate-stream-ui.spec.ts` - Fixed Page import
- `trade-app/nextjs-frontend/tests/support/fixtures/index.ts` - Added TypeScript types
- `trade-app/nextjs-frontend/tests/support/fixtures/debate-stream-fixtures.ts` - Fixed TypeScript types

**Configuration:**
- `trade-app/nextjs-frontend/jest.setup.ts` - Added jest-dom setup
- `trade-app/nextjs-frontend/jest.config.ts` - Added setupFilesAfterEnv
- `trade-app/nextjs-frontend/package.json` - Added @tanstack/react-virtual, framer-motion

**Documentation:**
- `_bmad-output/implementation-artifacts/tests/test-summary.md` - Updated with Story 1-5 results
