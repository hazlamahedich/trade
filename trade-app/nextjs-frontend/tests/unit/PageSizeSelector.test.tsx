import { render, screen, fireEvent } from "@testing-library/react";
import { PageSizeSelector } from "@/components/page-size-selector";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("PageSizeSelector with extraParams", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("preserves filter params when changing page size", () => {
    render(
      <PageSizeSelector
        currentSize={10}
        basePath="/dashboard/debates"
        extraParams={{ asset: "btc", outcome: "bull" }}
      />,
    );
    const trigger = screen.getByRole("combobox");
    fireEvent.click(trigger);
    const option = screen.getByText("20");
    fireEvent.click(option);
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("asset=btc"),
    );
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("outcome=bull"),
    );
  });

  it("backward compatible without extraParams", () => {
    render(<PageSizeSelector currentSize={10} />);
    const trigger = screen.getByRole("combobox");
    fireEvent.click(trigger);
    const option = screen.getByText("20");
    fireEvent.click(option);
    expect(mockPush).toHaveBeenCalledWith("/dashboard?page=1&size=20");
  });

  it("excludes empty-string extraParams values", () => {
    render(
      <PageSizeSelector
        currentSize={10}
        basePath="/dashboard/debates"
        extraParams={{ asset: "", outcome: "bull" }}
      />,
    );
    const trigger = screen.getByRole("combobox");
    fireEvent.click(trigger);
    const option = screen.getByText("20");
    fireEvent.click(option);
    const call = mockPush.mock.calls[0][0] as string;
    expect(call).toContain("outcome=bull");
    expect(call).not.toContain("asset=");
  });
});
