import * as React from "react";
import { Paper, Text } from "@mantine/core";
import { cn } from "@/lib/utils";

export function Card({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Paper withBorder radius="lg" shadow="xs" p={0} className={className}>
      {children}
    </Paper>
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-gray-100 px-5 py-4", className)} {...props} />;
}

export function CardTitle({ className, children }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <Text component="h3" fw={600} size="md" className={className}>
      {children}
    </Text>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}
