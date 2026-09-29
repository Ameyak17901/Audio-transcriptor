import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TranscriptionItem from "../TranscriptionItem";

describe("TranscriptionItem Component", () => {
  const mockItem = {
    id: "tx_test_1",
    createdAt: "2026-09-23T10:30:00.000Z",
    metadata: {
      duration: 8.4,
    },
    results: {
      channels: [
        {
          alternatives: [
            {
              transcript: "This is a recorded transcript sample for testing.",
              confidence: 0.98,
            },
          ],
        },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders transcript text, duration, and confidence badges", () => {
    render(<TranscriptionItem data={mockItem} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    expect(
      screen.getByText("This is a recorded transcript sample for testing.")
    ).toBeInTheDocument();
    expect(screen.getByText("8.4s")).toBeInTheDocument();
    expect(screen.getByText("98% accuracy")).toBeInTheDocument();
  });

  it("copies transcript text to clipboard and shows temporary Copied feedback", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(<TranscriptionItem data={mockItem} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    const copyBtn = screen.getByRole("button", {
      name: /copy transcript text to clipboard/i,
    });
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "This is a recorded transcript sample for testing."
    );

    await waitFor(() => {
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });
  });

  it("toggles inline edit mode and triggers onUpdate on save", () => {
    const handleUpdate = vi.fn();

    render(
      <TranscriptionItem
        data={mockItem}
        onUpdate={handleUpdate}
        onDelete={vi.fn()}
      />
    );

    // Click Edit button
    const editBtn = screen.getByRole("button", { name: /edit/i });
    fireEvent.click(editBtn);

    // Textarea should now be visible
    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeInTheDocument();

    // Type change
    fireEvent.change(textarea, {
      target: { value: "Updated transcript text without errors." },
    });

    // Save changes
    const saveBtn = screen.getByRole("button", { name: /save/i });
    fireEvent.click(saveBtn);

    expect(handleUpdate).toHaveBeenCalledWith(
      "tx_test_1",
      "Updated transcript text without errors."
    );
  });

  it("triggers onDelete when delete button is clicked", () => {
    const handleDelete = vi.fn();

    render(
      <TranscriptionItem
        data={mockItem}
        onUpdate={vi.fn()}
        onDelete={handleDelete}
      />
    );

    const deleteBtn = screen.getByRole("button", { name: /delete transcript/i });
    fireEvent.click(deleteBtn);

    expect(handleDelete).toHaveBeenCalledWith("tx_test_1");
  });

  it("renders transcript text from Deepgram live response payload correctly", () => {
    const liveDeepgramPayload = {
      metadata: {
        duration: 6.6,
        created: "2026-09-29T16:27:51.039Z",
      },
      results: {
        channels: [
          {
            alternatives: [
              {
                transcript: "Hello. Hello. Let's check. Let's just go and see. Hello. Hello.",
                confidence: 0.58947754,
              },
            ],
          },
        ],
      },
    };

    render(<TranscriptionItem data={liveDeepgramPayload} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    expect(
      screen.getByText("Hello. Hello. Let's check. Let's just go and see. Hello. Hello.")
    ).toBeInTheDocument();
    expect(screen.getByText("6.6s")).toBeInTheDocument();
    expect(screen.getByText("59% accuracy")).toBeInTheDocument();
  });

  it("falls back to paragraphs.transcript when alternatives[0].transcript is empty", () => {
    const payloadWithParagraphsOnly = {
      results: {
        channels: [
          {
            alternatives: [
              {
                transcript: "",
                paragraphs: {
                  transcript: "Fallback paragraph text",
                },
              },
            ],
          },
        ],
      },
    };

    render(<TranscriptionItem data={payloadWithParagraphsOnly} onUpdate={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByText("Fallback paragraph text")).toBeInTheDocument();
  });
});
