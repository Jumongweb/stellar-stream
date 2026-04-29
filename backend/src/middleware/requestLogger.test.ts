import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";
import { requestLogger } from "./requestLogger";
import type { Request, Response } from "express";

describe("requestLogger", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

  beforeEach(() => {
    consoleLogSpy.mockClear();
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("should not log Authorization headers", () => {
    const authHeader = "Bearer secret-token";
    const req = {
      method: "POST",
      originalUrl: "/api/streams",
      headers: {
        authorization: authHeader,
      },
    } as unknown as Request;

    const res = new EventEmitter() as Response;
    (res as any).statusCode = 201;

    const next = vi.fn();

    requestLogger(req, res, next);
    expect(next).toHaveBeenCalled();

    res.emit("finish");

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const logOutput = consoleLogSpy.mock.calls[0][0] as string;
    expect(logOutput).toContain("POST /api/streams");
    expect(logOutput).toContain("201");
    expect(logOutput).not.toContain(authHeader);
    expect(logOutput.toLowerCase()).not.toContain("authorization");
  });
});
