import { createFileRoute } from "@tanstack/react-router";
import { Nightbox } from "@/components/nightbox/app";

export const Route = createFileRoute("/")({ component: Nightbox });
