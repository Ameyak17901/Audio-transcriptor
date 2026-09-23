import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TranscribeHistory from "../TranscribeHistory";

// Mock react-router-dom useNavigate
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

describe("TranscribeHistory Component", () => {
  const sampleData = [
    {
      id: "tx_1",
      createdAt: "2026-09-23T10:00:00.000Z",
      results: { channels: [{ alternatives: [{ transcript: "Sprint planning notes" }] }] },
    },
    {
      id: "tx_2",
      createdAt: "2026-09-23T11:00:00.000Z",
      results: { channels: [{ alternatives: [{ transcript: "Client feedback audio" }] }] },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders history header with count and list items", () => {
    render(
      <TranscribeHistory
        data={sampleData}
        totalCount={2}
        searchQuery=""
        setSearchQuery={vi.fn()}
      />
    );

    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Sprint planning notes")).toBeInTheDocument();
    expect(screen.getByText("Client feedback audio")).toBeInTheDocument();
  });

  it("updates search input and triggers setSearchQuery", () => {
    const handleSetSearch = vi.fn();

    render(
      <TranscribeHistory
        data={sampleData}
        totalCount={2}
        searchQuery=""
        setSearchQuery={handleSetSearch}
      />
    );

    const searchInput = screen.getByPlaceholderText(/search transcripts.../i);
    fireEvent.change(searchInput, { target: { value: "sprint" } });

    expect(handleSetSearch).toHaveBeenCalledWith("sprint");
  });

  it("triggers onClearAll when Clear All is clicked and confirmed", () => {
    const handleClearAll = vi.fn();
    window.confirm = vi.fn(() => true);

    render(
      <TranscribeHistory
        data={sampleData}
        totalCount={2}
        searchQuery=""
        setSearchQuery={vi.fn()}
        onClearAll={handleClearAll}
      />
    );

    const clearBtn = screen.getByRole("button", { name: /clear all/i });
    fireEvent.click(clearBtn);

    expect(window.confirm).toHaveBeenCalled();
    expect(handleClearAll).toHaveBeenCalled();
  });

  it("shows empty search result guidance when search query matches nothing", () => {
    render(
      <TranscribeHistory
        data={[]}
        totalCount={2}
        searchQuery="unknown-keyword"
        setSearchQuery={vi.fn()}
      />
    );

    expect(screen.getByText("No matching items")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();
  });
});
