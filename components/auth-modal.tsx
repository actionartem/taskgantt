"use client"

import { useState } from "react"
import type { FormEvent } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface LoginData {
  login: string
  password: string
}

interface RegisterData extends LoginData {
  name: string
}

interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLogin?: (data: LoginData) => void
  onRegister?: (data: RegisterData) => void
}

export function AuthModal({ open, onOpenChange, onLogin, onRegister }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login")
  const [loginData, setLoginData] = useState<LoginData>({ login: "", password: "" })
  const [registerData, setRegisterData] = useState<RegisterData>({
    login: "",
    password: "",
    name: "",
  })

  const handleLoginSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onLogin?.(loginData)
    onOpenChange(false)
  }

  const handleRegisterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onRegister?.(registerData)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Добро пожаловать</DialogTitle>
          <DialogDescription>
            Авторизуйтесь, чтобы продолжить работу с системой управления задачами. Если у вас нет аккаунта, можно быстро
            зарегистрироваться.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "login" | "register")} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Вход</TabsTrigger>
            <TabsTrigger value="register">Регистрация</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-6">
            <form id="auth-login-form" className="space-y-4" onSubmit={handleLoginSubmit}>
              <div className="space-y-2">
                <Label htmlFor="auth-login-login">Логин</Label>
                <Input
                  id="auth-login-login"
                  autoComplete="username"
                  value={loginData.login}
                  onChange={(event) => setLoginData((previous) => ({ ...previous, login: event.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="auth-login-password">Пароль</Label>
                <Input
                  id="auth-login-password"
                  type="password"
                  autoComplete="current-password"
                  value={loginData.password}
                  onChange={(event) => setLoginData((previous) => ({ ...previous, password: event.target.value }))}
                  required
                />
              </div>

              <Button type="submit" className="w-full">
                Продолжить
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register" className="mt-6">
            <form id="auth-register-form" className="space-y-4" onSubmit={handleRegisterSubmit}>
              <div className="space-y-2">
                <Label htmlFor="auth-register-name">Имя</Label>
                <Input
                  id="auth-register-name"
                  autoComplete="name"
                  value={registerData.name}
                  onChange={(event) => setRegisterData((previous) => ({ ...previous, name: event.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="auth-register-login">Логин</Label>
                <Input
                  id="auth-register-login"
                  autoComplete="username"
                  value={registerData.login}
                  onChange={(event) => setRegisterData((previous) => ({ ...previous, login: event.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="auth-register-password">Пароль</Label>
                <Input
                  id="auth-register-password"
                  type="password"
                  autoComplete="new-password"
                  value={registerData.password}
                  onChange={(event) => setRegisterData((previous) => ({ ...previous, password: event.target.value }))}
                  required
                />
              </div>

              <Button type="submit" className="w-full">
                Создать аккаунт
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
