import Image from "next/image";
import LoginForm from "./LoginForm";

export const metadata = {
  title: "Prijava | Explore UNIZG",
  description: "Statička demonstracija AAI@EduHr prijave (bez autentikacije).",
};

export default function LoginPage() {
  return (
    <section className="min-h-[80vh] w-full flex items-center justify-center px-4 pt-24 pb-12">
      <div className="w-full">
        <div className="mb-8 text-center mx-auto w-full max-w-xl">
          <div className="flex items-center justify-center gap-3">
            <Image
              src="/assets/aai-eduhr.png"
              alt="AAI@EduHr"
              width={84}
              height={84}
              priority
              className="h-14 w-auto"
            />
            <div className="text-left leading-none">
              <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 leading-tight">
                AAI@EduHr
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400 max-w-xl">
                Autentikacijska i autorizacijska infrastruktura sustava znanosti i visokog obrazovanja u Republici Hrvatskoj
              </p>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-xl">
          <LoginForm />
        </div>

        <div className="mt-6 text-center mx-auto w-full max-w-xl">
          <a
            href="https://www.aaiedu.hr/"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Pomoć
          </a>
        </div>

        <div className="mt-8 text-center mx-auto w-full max-w-xl">
          <span className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-500">
            <span className="text-red-500">❤</span> srce <span className="text-xs align-top">v4.0</span>
          </span>
        </div>
      </div>
    </section>
  );
}


