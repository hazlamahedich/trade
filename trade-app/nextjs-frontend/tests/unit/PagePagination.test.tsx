import { render, screen } from "@testing-library/react";
import { PagePagination } from "@/components/page-pagination";

jest.mock("next/link", () => {
  return function MockLink({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) {
    return <a href={href}>{children}</a>;
  };
});

describe("PagePagination with extraParams", () => {
  it("merges extraParams into URLs", () => {
    render(
      <PagePagination
        currentPage={1}
        totalPages={5}
        pageSize={20}
        totalItems={100}
        basePath="/dashboard/debates"
        extraParams={{ asset: "btc", outcome: "bull" }}
      />,
    );
    const links = screen.getAllByRole("link");
    const firstLink = links[0];
    const href = firstLink.getAttribute("href") ?? "";
    expect(href).toContain("asset=btc");
    expect(href).toContain("outcome=bull");
  });

  it("backward compatible without extraParams", () => {
    render(
      <PagePagination
        currentPage={1}
        totalPages={5}
        pageSize={10}
        totalItems={50}
      />,
    );
    const links = screen.getAllByRole("link");
    const href = links[0].getAttribute("href") ?? "";
    expect(href).toMatch(/^\/dashboard\?page=1&size=10$/);
  });

  it("excludes empty-string extraParams values", () => {
    render(
      <PagePagination
        currentPage={1}
        totalPages={5}
        pageSize={20}
        totalItems={100}
        basePath="/dashboard/debates"
        extraParams={{ asset: "btc", outcome: "" }}
      />,
    );
    const links = screen.getAllByRole("link");
    const href = links[0].getAttribute("href") ?? "";
    expect(href).toContain("asset=btc");
    expect(href).not.toContain("outcome=");
  });

  it("shows Showing X to Y of Z text", () => {
    render(
      <PagePagination
        currentPage={2}
        totalPages={5}
        pageSize={20}
        totalItems={100}
      />,
    );
    expect(screen.getByText(/Showing 21 to 40 of 100 results/)).toBeInTheDocument();
  });

  it("shows Showing 0 of 0 for empty results", () => {
    render(
      <PagePagination
        currentPage={1}
        totalPages={0}
        pageSize={20}
        totalItems={0}
      />,
    );
    expect(screen.getByText(/Showing 0 of 0 results/)).toBeInTheDocument();
  });

  it("shows Page X of Y text", () => {
    render(
      <PagePagination
        currentPage={3}
        totalPages={5}
        pageSize={20}
        totalItems={100}
      />,
    );
    expect(screen.getByText(/Page 3 of 5/)).toBeInTheDocument();
  });
});
