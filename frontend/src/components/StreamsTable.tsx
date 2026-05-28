
import { memo, useCallback, useMemo, useRef, useState, RefObject } from "react";
import { Stream } from "../types/stream";
import { getExportCsvUrl, ListStreamsFilters, cancelStream } from "../services/api";
import { CopyableAddress } from "./CopyableAddress";
import { StreamTimeline } from "./StreamTimeline";
import { getHealthBadges } from "../utils/streamHealthBadges";
import { FilterBar } from "./FilterBar";

interface StreamsTableProps {
  streams: Stream[];
  loading?: boolean;
  filters: ListStreamsFilters;
  onFiltersChange: (f: ListStreamsFilters) => void;
  onCancel: (streamId: string) => Promise<void>;
  onPause: (streamId: string) => Promise<void>;
  onResume: (streamId: string) => Promise<void>;
  onOpenStream?: (streamId: string) => void;
  /**
   * Called when the user clicks "Edit" for a scheduled stream.
   * Receives the stream AND the button ref so the modal can return focus.
   */
  onEditStartTime: (stream: Stream, triggerRef: RefObject<HTMLButtonElement | null>) => void;
}

// ── Skeleton rows (#397) ──────────────────────────────────────────────────

const SKELETON_ROW_COUNT = 6;

function SkeletonRow() {
  return (
    <tr aria-hidden="true">
      <td><div className="skeleton" style={{ width: "80px", height: "16px" }} /></td>
      <td><div className="skeleton" style={{ width: "120px", height: "32px" }} /></td>
      <td><div className="skeleton" style={{ width: "90px", height: "16px" }} /></td>
      <td><div className="skeleton" style={{ width: "100%", height: "20px" }} /></td>
      <td><div className="skeleton" style={{ width: "70px", height: "20px" }} /></td>
      <td><div className="skeleton" style={{ width: "80px", height: "28px" }} /></td>
    </tr>
  );
}

function statusClass(status: Stream["progress"]["status"]): string {
  switch (status) {
    case "active":    return "badge badge-active";
    case "scheduled": return "badge badge-scheduled";
    case "completed": return "badge badge-completed";
    case "canceled":  return "badge badge-canceled";
    case "paused":    return "badge badge-paused";
    default:          return "badge";
  }
}

function formatTimestamp(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString();
}




export function StreamsTable({
  streams,
  loading = false,
  filters,
  onFiltersChange,
  onCancel,
  onPause,
  onResume,
  onEditStartTime,
  onOpenStream,
}: StreamsTableProps) {
  const [selectedStreamIds, setSelectedStreamIds] = useState<Set<string>>(new Set());
  const [expandedStreamId, setExpandedStreamId] = useState<string | null>(null);
  const [isBulkCanceling, setIsBulkCanceling] = useState(false);
  const [bulkCancelProgress, setBulkCancelProgress] = useState({ current: 0, total: 0 });

  const exportUrl = useMemo(() => getExportCsvUrl(filters), [filters]);

  // Sorted streams (stable sort by id to avoid unnecessary re-renders)
  const sortedStreams = useMemo(() => [...streams].sort((a, b) => a.id.localeCompare(b.id)), [streams]);

  // Helper: determine if a stream is eligible for selection (active or scheduled)
  const isStreamSelectable = useCallback((stream: Stream): boolean => {
    return stream.progress.status === "active" || stream.progress.status === "scheduled";
  }, []);

  // Get all selectable streams on current page
  const selectableStreams = useMemo(() => streams.filter(isStreamSelectable), [streams, isStreamSelectable]);
  const selectableIds = useMemo(() => new Set(selectableStreams.map((s) => s.id)), [selectableStreams]);

  // Determine if all selectable streams are selected
  const allSelectableSelected = useMemo(() =>
    selectableStreams.length > 0 &&
    selectableStreams.every((stream) => selectedStreamIds.has(stream.id)),
  [selectableStreams, selectedStreamIds]);

  // Handle individual checkbox toggle
  const handleCheckboxToggle = useCallback((streamId: string) => {
    setSelectedStreamIds((prev) => {
      const next = new Set(prev);
      if (next.has(streamId)) {
        next.delete(streamId);
      } else {
        next.add(streamId);
      }
      return next;
    });
  }, []);

  // Handle "Select All" toggle
  const handleSelectAllToggle = useCallback(() => {
    if (allSelectableSelected) {
      setSelectedStreamIds((prev) => {
        const next = new Set(prev);
        selectableIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedStreamIds((prev) => {
        const next = new Set(prev);
        selectableIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [allSelectableSelected, selectableIds]);

  const toggleTimeline = useCallback((id: string) => {
    setExpandedStreamId((prev) => (prev === id ? null : id));
  }, []);

  // Sequential bulk cancellation
  const handleBulkCancel = useCallback(async () => {
    const idsToCancel = Array.from(selectedStreamIds);
    if (idsToCancel.length === 0) return;

    setIsBulkCanceling(true);
    setBulkCancelProgress({ current: 0, total: idsToCancel.length });

    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < idsToCancel.length; i++) {
      const streamId = idsToCancel[i];
      setBulkCancelProgress({ current: i + 1, total: idsToCancel.length });
      try {
        await cancelStream(streamId);
        successCount++;
      } catch (error) {
        console.error(`Failed to cancel stream ${streamId}:`, error);
        failureCount++;
      }
    }

    setSelectedStreamIds(new Set());
    setIsBulkCanceling(false);
    setBulkCancelProgress({ current: 0, total: 0 });
    console.log(`Bulk cancellation complete: ${successCount} succeeded, ${failureCount} failed`);
  }, [selectedStreamIds]);



  return (
    <>
      <div className="card">
        <FilterBar filters={filters} onChange={onFiltersChange} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <h2 style={{ margin: 0 }}>Live Streams</h2>
          <a href={exportUrl} className="btn-ghost" download>
            Export CSV
          </a>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table aria-busy={loading} aria-label="Streams">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Select all streams"
                    checked={allSelectableSelected}
                    onChange={handleSelectAllToggle}
                    disabled={loading}
                  />
                </th>
                <th>ID</th>
                <th>Addresses</th>
                <th>Amount</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
                    <SkeletonRow key={i} />
                  ))
                : sortedStreams.map((stream) => {
                    const isScheduled = stream.progress.status === "scheduled";
                    const isFinalised =
                      stream.progress.status === "completed" ||
                      stream.progress.status === "canceled";
                    const isExpanded = expandedStreamId === stream.id;
                    const healthBadges = getHealthBadges(stream);
                    return (
                      <StreamRow
                        key={stream.id}
                        stream={stream}
                        isScheduled={isScheduled}
                        isFinalised={isFinalised}
                        isExpanded={isExpanded}
                        healthBadges={healthBadges}
                        isSelected={selectedStreamIds.has(stream.id)}
                        onToggleTimeline={toggleTimeline}
                        onCheckboxToggle={handleCheckboxToggle}
                        onCancel={onCancel}
                        onPause={onPause}
                        onResume={onResume}
                        onEditStartTime={onEditStartTime}
                        onOpenStream={onOpenStream}
                      />
                    );
                  })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Action Bar */}
      {selectedStreamIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedStreamIds.size}
          onCancel={handleBulkCancel}
          isCanceling={isBulkCanceling}
          progress={bulkCancelProgress}
        />
      )}
    </>
  );
}

/**
 * BulkActionBar Component
 * 
 * Floating action bar that appears at the bottom of the viewport when streams are selected.
 * Provides visual feedback during bulk cancellation operations.
 * 
 * Features:
 * - Fixed positioning with high z-index (1000) to stay above other content
 * - Slide-up animation on mount
 * - Shows selected count and cancel button
 * - Displays progress during cancellation (e.g., "Canceling 3/10...")
 * - Button is disabled during operation to prevent duplicate submissions
 * - Responsive design: centered on desktop, full-width on mobile
 */
interface BulkActionBarProps {
  selectedCount: number;
  onCancel: () => void;
  isCanceling: boolean;
  progress: { current: number; total: number };
}

function BulkActionBar({
  selectedCount,
  onCancel,
  isCanceling,
  progress,
}: BulkActionBarProps) {
  return (
    <div className="bulk-action-bar">
      <div className="bulk-action-bar__content">
        <span className="bulk-action-bar__count">
          {selectedCount} stream{selectedCount !== 1 ? "s" : ""} selected
        </span>
        <button
          className="bulk-action-bar__button"
          onClick={onCancel}
          disabled={isCanceling}
        >
          {isCanceling
            ? `Canceling ${progress.current}/${progress.total}...`
            : `Cancel ${selectedCount} Stream${selectedCount !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}

// ── StreamRow ─────────────────────────────────────────────────────────────
// Extracted so each row can hold its own triggerRef without polluting the
// parent component's hook rules.

interface StreamRowProps {
  stream: Stream;
  isScheduled: boolean;
  isFinalised: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  healthBadges: ReturnType<typeof getHealthBadges>;
  onToggleTimeline: (id: string) => void;
  onCheckboxToggle: (id: string) => void;
  onCancel: (id: string) => Promise<void>;
  onPause: (id: string) => Promise<void>;
  onResume: (id: string) => Promise<void>;
  onEditStartTime: StreamsTableProps["onEditStartTime"];
  onOpenStream?: (streamId: string) => void;
}

const StreamRow = memo(function StreamRow({
  stream,
  isScheduled,
  isFinalised,
  isExpanded,
  isSelected,
  healthBadges,
  onToggleTimeline,
  onCheckboxToggle,
  onCancel,
  onPause,
  onResume,
  onEditStartTime,
  onOpenStream,
}: StreamRowProps) {
  /**
   * Stable ref to the "✏️ Edit" button in this row.
   * Passed to the modal so focus returns here when the modal closes.
   */
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const isPaused = stream.progress.status === "paused";
  const isActive = stream.progress.status === "active";

  return (
    <>
      <tr>
        <td>
          <input
            type="checkbox"
            aria-label={`Select stream ${stream.id}`}
            checked={isSelected}
            onChange={() => onCheckboxToggle(stream.id)}
            disabled={isFinalised}
          />
        </td>
        <td>
          <button
            type="button"
            className="btn-ghost"
            aria-expanded={isExpanded}
            aria-controls={`timeline-${stream.id}`}
            onClick={() => {
              onToggleTimeline(stream.id);
              onOpenStream?.(stream.id);
            }}
            title={isExpanded ? "Hide timeline" : "Show timeline"}
          >
            {isExpanded ? "▲" : "▼"} {stream.id}
          </button>
        </td>
        <td>
          <div className="stacked">
            <CopyableAddress address={stream.sender} truncationMode="end" />
            <CopyableAddress address={stream.recipient} truncationMode="end" />
          </div>
        </td>
        <td>
          {stream.totalAmount} {stream.assetCode}
          <div className="muted">Start: {formatTimestamp(stream.startAt)}</div>
        </td>
        <td>
          <div className="progress-copy">
            <strong>{stream.progress.percentComplete}%</strong>
            <span className="muted">
              Vested: {stream.progress.vestedAmount} {stream.assetCode}
            </span>
          </div>
          <div className="progress-bar" aria-hidden>
            <div
              style={{
                width: `${Math.min(stream.progress.percentComplete, 100)}%`,
              }}
            />
          </div>
        </td>
        <td>
          <div className="status-cell">
            <span className={statusClass(stream.progress.status)}>
              {stream.progress.status}
            </span>
            {healthBadges.length > 0 && (
              <div className="health-badge-row" role="list" aria-label="Health badges">
                {healthBadges.map((badge) => (
                  <span
                    key={badge.key}
                    className={badge.cssClass}
                    title={badge.title}
                    role="listitem"
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </td>
        <td>
          <div className="action-cell">
            {isScheduled && (
              <button
                ref={editBtnRef}
                className="btn-ghost btn-edit"
                type="button"
                aria-label={`Edit start time for stream ${stream.id}`}
                onClick={() => onEditStartTime(stream, editBtnRef)}
              >
                ✏️ Edit
              </button>
            )}
            {isActive && (
              <button
                className="btn-ghost"
                type="button"
                aria-label={`Pause stream ${stream.id}`}
                onClick={() => onPause(stream.id)}
              >
                ⏸ Pause
              </button>
            )}
            {isPaused && (
              <button
                className="btn-ghost"
                type="button"
                aria-label={`Resume stream ${stream.id}`}
                onClick={() => onResume(stream.id)}
              >
                ▶ Resume
              </button>
            )}
            <button
              className="btn-ghost"
              type="button"
              aria-label={`Cancel stream ${stream.id}`}
              onClick={() => onCancel(stream.id)}
              disabled={isFinalised}
            >
              Cancel
            </button>
          </div>
        </td>
      </tr>

      {isExpanded && (
        <tr id={`timeline-${stream.id}`}>
          <td
            colSpan={7}
            style={{
              padding: "1rem 1.5rem",
              background: "var(--color-background-secondary)",
            }}
          >
            <StreamTimeline streamId={stream.id} />
          </td>
        </tr>
      )}
    </>
  );
}, (prev, next) =>
  prev.stream === next.stream &&
  prev.isExpanded === next.isExpanded &&
  prev.isSelected === next.isSelected &&
  prev.isScheduled === next.isScheduled &&
  prev.isFinalised === next.isFinalised
);