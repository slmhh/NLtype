import { useState } from "react";
import { Modal, Form, Input, Button, Message } from "@arco-design/web-react";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { api } from "../services/api";

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AuthModal({ visible, onClose }: AuthModalProps) {
  const { login, register } = useAuth();
  const { t } = useI18n();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [view, setView] = useState<"main" | "forgot" | "reset">("main");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      setLoading(true);

      if (tab === "login") {
        await login(values.identifier, values.password);
        Message.success(t("auth.loginSuccess"));
      } else {
        await register(values.username, values.email, values.password);
        Message.success(t("auth.registerSuccess"));
      }

      form.resetFields();
      onClose();
    } catch (e: any) {
      if (e.message) Message.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async () => {
    if (!forgotEmail) { Message.error(t("auth.emailRequired")); return; }
    setForgotLoading(true);
    try {
      await api("/api/auth/forgot-password", {
        method: "POST",
        body: { email: forgotEmail },
      });
      setForgotSent(true);
    } catch (e: any) {
      Message.error(e.message);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetSubmit = async () => {
    if (!resetToken || !resetPassword) { Message.error(t("auth.passwordRequired")); return; }
    if (resetPassword.length < 8) { Message.error(t("auth.passwordMin")); return; }
    setResetLoading(true);
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: { token: resetToken, newPassword: resetPassword },
      });
      Message.success(t("auth.resetPasswordSuccess"));
      setView("main");
      setForgotSent(false);
      setForgotEmail("");
      setResetToken("");
      setResetPassword("");
    } catch (e: any) {
      Message.error(e.message);
    } finally {
      setResetLoading(false);
    }
  };

  const switchTab = (t: "login" | "register") => {
    setTab(t);
    form.resetFields();
    setView("main");
    setForgotSent(false);
    setForgotEmail("");
    setResetToken("");
    setResetPassword("");
  };

  const goToMain = () => {
    setView("main");
    setForgotSent(false);
    setForgotEmail("");
    setResetToken("");
    setResetPassword("");
  };

  return (
    <Modal
      title={null}
      visible={visible}
      onCancel={onClose}
      footer={null}
      closable={false}
      alignCenter
      autoFocus={false}
      style={{ width: 380 }}
    >
      <div className="select-none">
        {view === "forgot" && (
          <>
            <div className="text-center mb-6">
              {forgotSent ? (
                <>
                  <p className="text-[var(--text-primary)] text-sm tracking-wider mb-2">✓</p>
                  <p className="text-[var(--text-tertiary)] text-xs tracking-wider leading-relaxed">
                    {t("auth.emailSent")}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[var(--text-primary)] text-sm tracking-[0.15em] mb-2">{t("auth.forgotPasswordTitle")}</p>
                  <p className="text-[var(--text-tertiary)] text-xs tracking-wider">{t("auth.forgotPasswordDesc")}</p>
                </>
              )}
            </div>

            {!forgotSent && (
              <>
                <label className="text-[var(--text-tertiary)] text-xs tracking-wider block mb-2">{t("auth.email")}</label>
                <Input
                  value={forgotEmail}
                  onChange={setForgotEmail}
                  placeholder={t("auth.emailPlaceholder")}
                  className="!mb-4"
                />
                <Button
                  type="primary"
                  long
                  onClick={handleForgotSubmit}
                  loading={forgotLoading}
                  className="!h-10 !text-sm !tracking-[0.15em] !rounded-xl"
                >
                  {t("auth.forgotPasswordBtn")}
                </Button>
              </>
            )}

            {forgotSent && (
              <>
                <div className="bg-[var(--bg-alt)] rounded-xl p-3 mb-4">
                  <label className="text-[var(--text-tertiary)] text-xs tracking-wider block mb-2">{t("auth.resetPasswordTitle")}</label>
                  <Input
                    value={resetToken}
                    onChange={setResetToken}
                    placeholder="Reset token"
                    className="!mb-3"
                  />
                  <Input.Password
                    value={resetPassword}
                    onChange={setResetPassword}
                    placeholder={t("auth.newPassword")}
                    className="!mb-4"
                  />
                  <Button
                    type="primary"
                    long
                    onClick={handleResetSubmit}
                    loading={resetLoading}
                    className="!h-10 !text-sm !tracking-[0.15em] !rounded-xl"
                  >
                    {t("auth.resetPassword")}
                  </Button>
                </div>
                <p className="text-[var(--text-tertiary)] text-xs text-center tracking-wider mb-4">
                  {t("auth.forgotPasswordSent")}
                </p>
              </>
            )}

            <button
              onClick={goToMain}
              className="block w-full text-center text-[var(--text-tertiary)] text-xs tracking-wider mt-2 hover:text-[var(--text-secondary)] transition-colors"
            >
              ← {t("auth.login")}
            </button>
          </>
        )}

        {view === "main" && (
          <>
            {/* Tabs */}
            <div className="flex mb-6 border-b border-[var(--border)]">
              <button
                onClick={() => switchTab("login")}
                className={`flex-1 pb-3 text-sm tracking-[0.15em] transition-colors font-mono ${
                  tab === "login"
                    ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {t("auth.login")}
              </button>
              <button
                onClick={() => switchTab("register")}
                className={`flex-1 pb-3 text-sm tracking-[0.15em] transition-colors font-mono ${
                  tab === "register"
                    ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {t("auth.register")}
              </button>
            </div>

            <Form form={form} layout="vertical" size="default">
              {tab === "register" && (
                <Form.Item
                  field="username"
                  label={t("auth.username")}
                  rules={[
                    { required: true, message: t("auth.usernameRequired") },
                    { minLength: 3, message: t("auth.usernameMin") },
                    { maxLength: 20, message: t("auth.usernameMax") },
                    { match: /^[a-zA-Z0-9_]+$/, message: t("auth.usernamePattern") },
                  ]}
                >
                  <Input placeholder={t("auth.usernamePlaceholder")} />
                </Form.Item>
              )}

              <Form.Item
                field="identifier"
                hidden={tab !== "login"}
                label={t("auth.identifier")}
                rules={[{ required: true, message: t("auth.identifierRequired") }]}
              >
                <Input placeholder={t("auth.identifierPlaceholder")} />
              </Form.Item>

              {tab === "register" && (
                <Form.Item
                  field="email"
                  label={t("auth.email")}
                  rules={[
                    { required: true, message: t("auth.emailRequired") },
                    { type: "email", message: t("auth.emailInvalid") },
                  ]}
                >
                  <Input placeholder={t("auth.emailPlaceholder")} />
                </Form.Item>
              )}

              <Form.Item
                field="password"
                label={t("auth.password")}
                rules={[
                  { required: true, message: t("auth.passwordRequired") },
                  ...(tab === "register" ? [{ minLength: 8, message: t("auth.passwordMin") }] : []),
                ]}
              >
                <Input.Password placeholder={tab === "register" ? t("auth.passwordPlaceholderReg") : t("auth.passwordPlaceholderLog")} />
              </Form.Item>

              {tab === "login" && (
                <div className="text-right -mt-3 mb-3">
                  <button
                    onClick={() => setView("forgot")}
                    className="text-[var(--text-tertiary)] text-xs tracking-wider hover:text-[var(--text-secondary)] transition-colors"
                  >
                    {t("auth.forgotPassword")}
                  </button>
                </div>
              )}

              <Button
                type="primary"
                long
                onClick={handleSubmit}
                loading={loading}
                className="!h-10 !text-sm !tracking-[0.15em] !rounded-xl !mt-2"
              >
                {tab === "login" ? t("auth.login") : t("auth.register")}
              </Button>
            </Form>
          </>
        )}
      </div>
    </Modal>
  );
}
