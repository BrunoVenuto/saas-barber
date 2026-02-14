import "./globals.css";

export const metadata = {
  title: "Barber Premium",
  description: "Sistema premium de agendamento para barbearias",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-background text-text antialiased">
        {children}
      </body>
    </html>
  );
}
