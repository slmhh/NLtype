import { useState } from "react";
import { Modal, Form, Input, Button, Message } from "@arco-design/web-react";
import { useAuth } from "../context/AuthContext";

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function AuthModal({ visible, onClose }: AuthModalProps) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      setLoading(true);

      if (tab === "login") {
        await login(values.identifier, values.password);
        Message.success("登录成功");
      } else {
        await register(values.username, values.email, values.password);
        Message.success("注册成功");
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
            登录
          </button>
          <button
            onClick={() => switchTab("register")}
            className={`flex-1 pb-3 text-sm tracking-[0.15em] transition-colors font-mono ${
              tab === "register"
                ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}
          >
            注册
          </button>
        </div>

        <Form form={form} layout="vertical" size="default">
          {tab === "register" && (
            <Form.Item
              field="username"
              label="用户名"
              rules={[
                { required: true, message: "请输入用户名" },
                { minLength: 3, message: "用户名至少3个字符" },
                { maxLength: 20, message: "用户名最多20个字符" },
                { match: /^[a-zA-Z0-9_]+$/, message: "只能包含字母、数字和下划线" },
              ]}
            >
              <Input placeholder="3-20位字母、数字或下划线" />
            </Form.Item>
          )}

          <Form.Item
            field="identifier"
            hidden={tab !== "login"}
            label="用户名或邮箱"
            rules={[{ required: true, message: "请输入用户名或邮箱" }]}
          >
            <Input placeholder="用户名或邮箱" />
          </Form.Item>

          {tab === "register" && (
            <Form.Item
              field="email"
              label="邮箱"
              rules={[
                { required: true, message: "请输入邮箱" },
                { type: "email", message: "邮箱格式不正确" },
              ]}
            >
              <Input placeholder="your@email.com" />
            </Form.Item>
          )}

          <Form.Item
            field="password"
            label="密码"
            rules={[
              { required: true, message: "请输入密码" },
              ...(tab === "register" ? [{ minLength: 8, message: "密码至少8个字符" }] : []),
            ]}
          >
            <Input.Password placeholder={tab === "register" ? "至少8个字符" : "输入密码"} />
          </Form.Item>

          <Button
            type="primary"
            long
            onClick={handleSubmit}
            loading={loading}
            className="!h-10 !text-sm !tracking-[0.15em] !rounded-xl !mt-2"
          >
            {tab === "login" ? "登录" : "注册"}
          </Button>
        </Form>
      </div>
    </Modal>
  );
}
