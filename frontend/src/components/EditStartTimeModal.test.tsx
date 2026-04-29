import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { EditStartTimeModal } from "./EditStartTimeModal";

const mockStream = {
  id: "123",
  startAt: Math.floor(Date.now() / 1000) + 3600,
  totalAmount: "100",
  assetCode: "XLM",
} as any;

function toDatetimeLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function setup(props = {}) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  render(
    <EditStartTimeModal
      stream={mockStream}
      onConfirm={onConfirm}
      onClose={onClose}
      {...props}
    />
  );

  return { onConfirm, onClose };
}

describe("EditStartTimeModal", () => {
  it("calls API and closes modal for valid future time", async () => {
    const user = userEvent.setup();
    const { onConfirm, onClose } = setup();

    onConfirm.mockResolvedValueOnce(undefined);

    const input = screen.getByLabelText(/new start time/i);
    const saveBtn = screen.getByRole("button", { name: /save/i });

    const futureValue = toDatetimeLocal(
      new Date(Date.now() + 2 * 60 * 60 * 1000)
    );

    await user.clear(input);
    await user.type(input, futureValue);
    await user.click(saveBtn);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith("123", expect.any(Number));
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("shows validation error for past time and does not call API", async () => {
    const user = userEvent.setup();
    const { onConfirm } = setup();

    const input = screen.getByLabelText(/new start time/i);
    const saveBtn = screen.getByRole("button", { name: /save/i });

    const pastValue = toDatetimeLocal(
      new Date(Date.now() - 60 * 60 * 1000)
    );

    await user.clear(input);
    await user.type(input, pastValue);
    await user.click(saveBtn);

    expect(
      await screen.findByText(/start time must be in the future/i)
    ).toBeInTheDocument();

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("shows API error when request fails", async () => {
    const user = userEvent.setup();
    const { onConfirm, onClose } = setup();

    onConfirm.mockRejectedValueOnce(new Error("API failed"));

    const input = screen.getByLabelText(/new start time/i);
    const saveBtn = screen.getByRole("button", { name: /save/i });

    const futureValue = toDatetimeLocal(
      new Date(Date.now() + 2 * 60 * 60 * 1000)
    );

    await user.clear(input);
    await user.type(input, futureValue);
    await user.click(saveBtn);

    expect(await screen.findByText(/update failed/i)).toBeInTheDocument();
    expect(await screen.findByText(/api failed/i)).toBeInTheDocument();

    expect(onClose).not.toHaveBeenCalled();
  });
});