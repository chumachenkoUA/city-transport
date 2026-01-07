import React, { useState } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/utils";
import { MapPin, Ticket, Database, Globe, ShieldCheck, ArrowRight } from "lucide-react";

export const AuthPage = () => {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

  return (
    <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-2 bg-background text-text">
      {/* Left Column: Marketing */}
      <div className="relative flex flex-col justify-center p-8 lg:p-16 overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-accent/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px]" />

        <div className="relative z-10 space-y-8 max-w-lg">
          <Badge className="bg-accent/10 text-accent border-accent/20 backdrop-blur-sm">
            City Transport System v2.0
          </Badge>

          <h1 className="text-5xl lg:text-7xl font-bold leading-tight">
            Рухайся містом <br />
            <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
              вільно
            </span>
          </h1>

          <p className="text-xl text-muted">
            Єдина платформа для керування міським транспортом, оплати проїзду та
            моніторингу руху в реальному часі.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            <FeatureCard
              icon={<MapPin className="text-accent" />}
              title="GPS Трекінг"
              desc="Слідкуй за транспортом онлайн"
            />
            <FeatureCard
              icon={<Ticket className="text-pink-400" />}
              title="Е-квиток"
              desc="Сплачуй без готівки"
            />
          </div>

          <div className="flex gap-2 pt-8">
            <TechBadge icon={<Globe size={14} />} text="PostGIS" />
            <TechBadge icon={<Database size={14} />} text="GeoJSON" />
            <TechBadge icon={<ShieldCheck size={14} />} text="RLS Security" />
          </div>
        </div>
      </div>

      {/* Right Column: Form */}
      <div className="flex flex-col items-center justify-center p-4 sm:p-8 lg:p-16 bg-surface/50 backdrop-blur-sm border-l border-white/5">
        <Card className="w-full max-w-md p-1 overflow-hidden relative group">
           {/* Top Gradient Line */}
           <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-accent to-transparent opacity-50" />
           
           <div className="p-6 sm:p-8 space-y-6">
             <div className="flex gap-1 bg-black/20 p-1 rounded-2xl mb-6">
                <TabButton 
                  active={activeTab === 'login'} 
                  onClick={() => setActiveTab('login')}
                >
                  Вхід
                </TabButton>
                <TabButton 
                  active={activeTab === 'register'} 
                  onClick={() => setActiveTab('register')}
                >
                  Реєстрація
                </TabButton>
             </div>

             {activeTab === 'login' ? <LoginForm /> : <RegisterForm />}
             
             <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-surface px-2 text-muted">або</span>
                </div>
              </div>

              <a href="/guest" className="group flex items-center justify-center gap-2 text-sm text-muted hover:text-accent transition-colors">
                Я просто хочу знайти маршрут
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </a>
           </div>
        </Card>
      </div>
    </div>
  );
};

// Sub-components for AuthPage

const FeatureCard = ({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) => (
  <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
    <div className="p-2 rounded-xl bg-black/30 border border-white/5">
      {icon}
    </div>
    <div>
      <h3 className="font-semibold text-text">{title}</h3>
      <p className="text-sm text-muted">{desc}</p>
    </div>
  </div>
);

const TechBadge = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 border border-white/5 text-xs text-muted font-mono">
    {icon}
    <span>{text}</span>
  </div>
);

const TabButton = ({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex-1 py-2 text-sm font-medium rounded-xl transition-all duration-200",
      active 
        ? "bg-surface text-text shadow-lg border border-white/5" 
        : "text-muted hover:text-text hover:bg-white/5"
    )}
  >
    {children}
  </button>
);

const LoginForm = () => (
  <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted">Логін</label>
      <Input placeholder="user123" />
    </div>
    <div className="space-y-2">
      <div className="flex justify-between">
        <label className="text-sm font-medium text-muted">Пароль</label>
        <a href="#" className="text-xs text-accent hover:underline">Забули пароль?</a>
      </div>
      <Input type="password" placeholder="••••••••" />
    </div>
    <Button className="w-full mt-4" size="lg">Увійти</Button>
  </form>
);

const RegisterForm = () => (
  <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted">Ім'я</label>
        <Input placeholder="Іван" />
      </div>
      <div className="space-y-2">
         <label className="text-sm font-medium text-muted">Прізвище</label>
         <Input placeholder="Петренко" />
      </div>
    </div>
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted">Email</label>
      <Input type="email" placeholder="ivan@example.com" />
    </div>
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted">Логін</label>
      <Input placeholder="ivan_p" />
    </div>
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted">Пароль</label>
      <Input type="password" placeholder="••••••••" />
    </div>
    <Button className="w-full mt-4" size="lg">Створити акаунт</Button>
  </form>
);

export default AuthPage;