import { useState } from "react";
import { Modal, Form, Input, Button, Message } from "@arco-design/web-react";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AuthModal({ visible, onClose }: AuthModalProps) {
  const { login, register } = useAuth();
  const { t } = useI18n();
  const [tab, setTab] = useState<"login" | "register">("login");
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

  const switchTab = (t: "login" | "register") => {
    setTab(t);
    form.resetFields();
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
      </div>
    </Modal>
  );
}
