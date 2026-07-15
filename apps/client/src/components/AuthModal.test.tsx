import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AuthModal from "./AuthModal";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ login: vi.fn(), register: vi.fn() }),
}));

vi.mock("../context/I18nContext", () => ({
  useI18n: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        "auth.login": "登录",
        "auth.register": "注册",
        "auth.username": "用户名",
        "auth.usernamePlaceholder": "3-20位字母、数字或下划线",
        "auth.email": "邮箱",
        "auth.emailPlaceholder": "your@email.com",
        "auth.password": "密码",
        "auth.passwordPlaceholderReg": "至少8个字符",
        "auth.passwordPlaceholderLog": "输入密码",
        "auth.identifier": "用户名或邮箱",
        "auth.identifierPlaceholder": "用户名或邮箱",
      };
      return dict[key] ?? key;
    },
  }),
}));

describe("AuthModal", () => {
  it("renders login tab and register tab", () => {
    render(<AuthModal visible={true} onClose={() => {}} />);
    const buttons = screen.getAllByText("登录");
    expect(buttons.length).toBe(2); // tab + submit
    expect(screen.getByText("注册")).toBeTruthy();
  });

  it("shows identifier field in login mode", () => {
    render(<AuthModal visible={true} onClose={() => {}} />);
    expect(screen.getByPlaceholderText("用户名或邮箱")).toBeTruthy();
  });

  it("switches to register tab showing username/email fields", () => {
    render(<AuthModal visible={true} onClose={() => {}} />);
    fireEvent.click(screen.getByText("注册"));
    expect(screen.getByPlaceholderText("3-20位字母、数字或下划线")).toBeTruthy();
    expect(screen.getByPlaceholderText("your@email.com")).toBeTruthy();
  });

  it("shows password field in both modes", () => {
    render(<AuthModal visible={true} onClose={() => {}} />);
    expect(screen.getByPlaceholderText("输入密码")).toBeTruthy();
    fireEvent.click(screen.getByText("注册"));
    expect(screen.getByPlaceholderText("至少8个字符")).toBeTruthy();
  });

  it("renders nothing when not visible", () => {
    const { container } = render(<AuthModal visible={false} onClose={() => {}} />);
    expect(container.innerHTML).toBe("");
  });
});
