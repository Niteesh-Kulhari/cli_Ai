"use client";

import { LoginForm } from "@/components/ui/login-Form";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import React from "react";

const page = () => {
  const { data, isPending } = authClient.useSession();
  const router = useRouter();
  if (isPending) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Spinner />
      </div>
    );
  }

  if (data?.session && data?.user) {
    router.push("/");
  }

  return (
    <>
      <LoginForm />
    </>
  );
};

export default page;
