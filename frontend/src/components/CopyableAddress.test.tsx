import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CopyableAddress } from "./CopyableAddress";

describe("CopyableAddress Component", () => {
  const mockWriteText = vi.fn();
  const originalClipboard = global.navigator.clipboard;

  beforeEach(() => {
    vi.clearAllMocks();
    global.navigator.clipboard = {
      writeText: mockWriteText,
    } as unknown as Clipboard;
  });

  afterEach(() => {
    global.navigator.clipboard = originalClipboard;
  });

  it("truncates a 56-character G-address correctly in middle mode", () => {
    const longAddress = "G" + "A".repeat(54);
    render(<CopyableAddress address={longAddress} />);

    const addressSpan = screen.getByTitle(longAddress);
    expect(addressSpan.textContent).toBe("GAAAAAAA…AAAA");
  });

  it("truncates a 56-character G-address correctly in end mode", () => {
    const longAddress = "G" + "A".repeat(54);
    render(<CopyableAddress address={longAddress} truncationMode="end" />);

    const addressSpan = screen.getByTitle(longAddress);
    expect(addressSpan.textContent).toBe("GAAAAAAA...");
  });

  it("copies the full address to clipboard when button is clicked", async () => {
    const longAddress = "G" + "A".repeat(54);
    render(<CopyableAddress address={longAddress} />);

    const copyButton = screen.getByTitle("Copy address");
    fireEvent.click(copyButton);

    expect(mockWriteText).toHaveBeenCalledWith(longAddress);
  });

  it("shows copied feedback (✓) after clicking the copy button", async () => {
    const longAddress = "G" + "A".repeat(54);
    render(<CopyableAddress address={longAddress} />);

    const copyButton = screen.getByTitle("Copy address");
    expect(copyButton.textContent).toBe("📋");

    fireEvent.click(copyButton);

    expect(copyButton.textContent).toBe("✓");
  });

  it("displays full address without truncation when address is short", () => {
    const shortAddress = "GABC";
    render(<CopyableAddress address={shortAddress} />);

    const addressSpan = screen.getByTitle(shortAddress);
    expect(addressSpan.textContent).toBe("GABC");
  });

  it("displays full address without truncation when address is exactly 12 characters", () => {
    const exactLengthAddress = "GABCDEFGHIJ";
    render(<CopyableAddress address={exactLengthAddress} />);

    const addressSpan = screen.getByTitle(exactLengthAddress);
    expect(addressSpan.textContent).toBe("GABCDEFGHIJ");
  });

  it("handles clipboard errors gracefully", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockWriteText.mockRejectedValue(new Error("Clipboard error"));

    const longAddress = "G" + "A".repeat(54);
    render(<CopyableAddress address={longAddress} />);

    const copyButton = screen.getByTitle("Copy address");
    fireEvent.click(copyButton);

    expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to copy text", expect.any(Error));
    consoleErrorSpy.mockRestore();
  });
});
