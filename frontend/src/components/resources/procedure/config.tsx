import {
  ConfigInput,
  ConfigItem,
  ConfigSwitch,
  WebhookBuilder,
} from "@components/config/util";
import { Section } from "@components/layouts";
import {
  useLocalStorage,
  useRead,
  useWebhookIdOrName,
  useWebhookIntegrations,
  useWrite,
} from "@lib/hooks";
import { Types } from "komodo_client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ui/card";
import { Input } from "@ui/input";
import { useEffect, useState } from "react";
import { CopyWebhook, ResourceSelector } from "../common";
import { ConfigLayout } from "@components/config";
import { Popover, PopoverContent, PopoverTrigger } from "@ui/popover";
import { Button } from "@ui/button";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Info,
  Minus,
  MinusCircle,
  Plus,
  PlusCircle,
  SearchX,
  Settings,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ui/command";
import { Switch } from "@ui/switch";
import { DataTable } from "@ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ui/dropdown-menu";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { filterBySplit } from "@lib/utils";
import { useToast } from "@ui/use-toast";
import { fmt_upper_camelcase } from "@lib/formatting";
import { TextUpdateMenuMonaco } from "@components/util";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui/select";

export const ProcedureConfig = ({ id }: { id: string }) => {
  const procedure = useRead("GetProcedure", { procedure: id }).data;
  if (!procedure) return null;
  return <ProcedureConfigInner procedure={procedure} />;
};

const PROCEDURE_GIT_PROVIDER = "Procedure";

const ProcedureConfigInner = ({
  procedure,
}: {
  procedure: Types.Procedure;
}) => {
  const [branch, setBranch] = useState("main");
  const config = procedure.config!;
  const [update, setUpdate] = useLocalStorage<Partial<Types.ProcedureConfig>>(
    `procedure-${procedure._id?.$oid}-update-v1`,
    {}
  );
  const perms = useRead("GetPermissionLevel", {
    target: { type: "Procedure", id: procedure._id?.$oid! },
  }).data;
  const global_disabled =
    useRead("GetCoreInfo", {}).data?.ui_write_disabled ?? false;
  const { mutateAsync } = useWrite("UpdateProcedure");
  const { integrations } = useWebhookIntegrations();
  const [id_or_name] = useWebhookIdOrName();
  const webhook_integration = integrations[PROCEDURE_GIT_PROVIDER] ?? "Github";

  const stages = update.stages || procedure.config?.stages || [];
  const disabled = global_disabled || perms !== Types.PermissionLevel.Write;

  const add_stage = () =>
    setUpdate((config) => ({
      ...config,
      stages: [...stages, new_stage(stages.length + 1)],
    }));

  return (
    <div className="flex flex-col gap-8">
      <ConfigLayout
        original={config}
        titleOther={
          <div className="flex items-center gap-4 text-muted-foreground">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <h2 className="text-xl">Config</h2>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">
                  <Info className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <div>
                  The executions in a stage are all run in parallel. The stages
                  themselves are run sequentially.
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        }
        disabled={disabled}
        update={update}
        onConfirm={async () => {
          await mutateAsync({ id: procedure._id!.$oid, config: update });
          setUpdate({});
        }}
        onReset={() => setUpdate({})}
      >
        {stages.map((stage, index) => (
          <Stage
            stage={stage}
            setStage={(stage) =>
              setUpdate((update) => ({
                ...update,
                stages: stages.map((s, i) => (index === i ? stage : s)),
              }))
            }
            removeStage={() =>
              setUpdate((update) => ({
                ...update,
                stages: stages.filter((_, i) => index !== i),
              }))
            }
            moveUp={
              index === 0
                ? undefined
                : () =>
                    setUpdate((update) => ({
                      ...update,
                      stages: stages.map((stage, i) => {
                        // Make sure its not the first row
                        if (i === index && index !== 0) {
                          return stages[index - 1];
                        } else if (i === index - 1) {
                          // Reverse the entry, moving this row "Up"
                          return stages[index];
                        } else {
                          return stage;
                        }
                      }),
                    }))
            }
            moveDown={
              index === stages.length - 1
                ? undefined
                : () =>
                    setUpdate((update) => ({
                      ...update,
                      stages: stages.map((stage, i) => {
                        // The index also cannot be the last index, which cannot be moved down
                        if (i === index && index !== stages.length - 1) {
                          return stages[index + 1];
                        } else if (i === index + 1) {
                          // Move the row "Down"
                          return stages[index];
                        } else {
                          return stage;
                        }
                      }),
                    }))
            }
            insertAbove={() =>
              setUpdate((update) => ({
                ...update,
                stages: [
                  ...stages.slice(0, index),
                  new_stage(index + 1),
                  ...stages.slice(index),
                ],
              }))
            }
            insertBelow={() =>
              setUpdate((update) => ({
                ...update,
                stages: [
                  ...stages.slice(0, index + 1),
                  new_stage(index + 2),
                  ...stages.slice(index + 1),
                ],
              }))
            }
            disabled={disabled}
          />
        ))}
        <Button
          variant="secondary"
          onClick={add_stage}
          className="w-fit"
          disabled={disabled}
        >
          Add Stage
        </Button>
      </ConfigLayout>
      <Section>
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
            <CardDescription>
              Configure the Procedure to run at defined times using English or
              CRON.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <ConfigSwitch
                label="Enabled"
                value={
                  (update.schedule ?? config.schedule)
                    ? (update.schedule_enabled ?? config.schedule_enabled)
                    : false
                }
                disabled={disabled || !(update.schedule ?? config.schedule)}
                onChange={(schedule_enabled) =>
                  setUpdate({ ...update, schedule_enabled })
                }
              />
              <ConfigItem
                label="Format"
                description="Choose whether to provide English or CRON schedule expression"
              >
                <Select
                  value={update.schedule_format ?? config.schedule_format}
                  onValueChange={(schedule_format) =>
                    setUpdate({
                      ...update,
                      schedule_format: schedule_format as Types.ScheduleFormat,
                      schedule: "",
                    })
                  }
                  disabled={disabled}
                >
                  <SelectTrigger className="w-[200px]" disabled={disabled}>
                    <SelectValue placeholder="Select Format" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(Types.ScheduleFormat).map((mode) => (
                      <SelectItem
                        key={mode}
                        value={mode!}
                        className="cursor-pointer"
                      >
                        {mode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ConfigItem>
              <ConfigInput
                label="Expression"
                description={
                  (update.schedule_format ?? config.schedule_format) ===
                  "Cron" ? (
                    <div className="pt-1 flex flex-col gap-1">
                      <code>
                        second - minute - hour - day - month - day-of-week
                      </code>
                    </div>
                  ) : (
                    <div className="pt-1 flex flex-col gap-1">
                      <code>Examples:</code>
                      <code>- Run every day at 4:00 pm</code>
                      <code>
                        - Run at 21:00 on the 1st and 15th of the month
                      </code>
                      <code>- Every Sunday at midnight</code>
                    </div>
                  )
                }
                placeholder={
                  (update.schedule_format ?? config.schedule_format) === "Cron"
                    ? "0 0 0 ? * SUN"
                    : "Enter English expression"
                }
                value={update.schedule ?? config.schedule}
                onChange={(schedule) => setUpdate({ ...update, schedule })}
                disabled={disabled}
              />
              <ConfigInput
                label="Timezone"
                description="Optional. Enter specific IANA timezone for schedule expression. If not provided, uses the Core timezone."
                placeholder="Enter IANA timezone"
                value={update.schedule_timezone ?? config.schedule_timezone}
                onChange={(schedule_timezone) =>
                  setUpdate({ ...update, schedule_timezone })
                }
                disabled={disabled}
              />
            </div>
          </CardContent>
        </Card>
      </Section>
      <Section>
        <Card>
          <CardHeader>
            <CardTitle>Webhook</CardTitle>
            <CardDescription>
              Copy the webhook given here, and configure your
              {webhook_integration}-style repo provider to send webhooks to
              Komodo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <ConfigItem>
                <WebhookBuilder git_provider={PROCEDURE_GIT_PROVIDER}>
                  <div className="text-nowrap text-muted-foreground text-sm">
                    Listen on branch:
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      placeholder="Branch"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      className="w-[200px]"
                      disabled={branch === "__ANY__"}
                    />
                    <div className="flex items-center gap-2">
                      <div className="text-muted-foreground text-sm">
                        No branch check:
                      </div>
                      <Switch
                        checked={branch === "__ANY__"}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setBranch("__ANY__");
                          } else {
                            setBranch("main");
                          }
                        }}
                      />
                    </div>
                  </div>
                </WebhookBuilder>
              </ConfigItem>
              <ConfigItem label="Webhook Url - Run">
                <CopyWebhook
                  integration={webhook_integration}
                  path={`/procedure/${id_or_name === "Id" ? procedure._id?.$oid! : procedure.name}/${branch}`}
                />
              </ConfigItem>
              <ConfigSwitch
                label="Webhook Enabled"
                value={
                  update.webhook_enabled ?? procedure.config?.webhook_enabled
                }
                disabled={disabled}
                onChange={(webhook_enabled) =>
                  setUpdate({ ...update, webhook_enabled })
                }
              />
              <ConfigInput
                label="Custom Secret"
                description="Provide a custom webhook secret for this resource, or use the global default."
                placeholder="Input custom secret"
                value={
                  update.webhook_secret ?? procedure.config?.webhook_secret
                }
                disabled={disabled}
                onChange={(webhook_secret) =>
                  setUpdate({ ...update, webhook_secret })
                }
              />
            </div>
          </CardContent>
        </Card>
      </Section>
    </div>
  );
};

const Stage = ({
  stage,
  setStage,
  removeStage,
  moveUp,
  moveDown,
  insertAbove,
  insertBelow,
  disabled,
}: {
  stage: Types.ProcedureStage;
  setStage: (stage: Types.ProcedureStage) => void;
  removeStage: () => void;
  insertAbove: () => void;
  insertBelow: () => void;
  moveUp: (() => void) | undefined;
  moveDown: (() => void) | undefined;
  disabled: boolean;
}) => {
  return (
    <Card className="p-4 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <Input
          value={stage.name}
          onChange={(e) => setStage({ ...stage, name: e.target.value })}
          className="w-[300px] text-md"
        />
        <div className="flex gap-4 items-center">
          <div>Enabled:</div>
          <Switch
            checked={stage.enabled}
            onCheckedChange={(enabled) => setStage({ ...stage, enabled })}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={disabled}>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0"
                disabled={disabled}
              >
                <span className="sr-only">Open menu</span>
                <DotsHorizontalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {moveUp && (
                <DropdownMenuItem
                  className="flex gap-4 justify-between cursor-pointer"
                  onClick={moveUp}
                >
                  Move Up <ArrowUp className="w-4 h-4" />
                </DropdownMenuItem>
              )}
              {moveDown && (
                <DropdownMenuItem
                  className="flex gap-4 justify-between cursor-pointer"
                  onClick={moveDown}
                >
                  Move Down <ArrowDown className="w-4 h-4" />
                </DropdownMenuItem>
              )}

              {(moveUp ?? moveDown) && <DropdownMenuSeparator />}

              <DropdownMenuItem
                className="flex gap-4 justify-between cursor-pointer"
                onClick={insertAbove}
              >
                Insert Above{" "}
                <div className="flex">
                  <ArrowUp className="w-4 h-4" />
                  <Plus className="w-4 h-4" />
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex gap-4 justify-between cursor-pointer"
                onClick={insertBelow}
              >
                Insert Below{" "}
                <div className="flex">
                  <ArrowDown className="w-4 h-4" />
                  <Plus className="w-4 h-4" />
                </div>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="flex gap-4 justify-between cursor-pointer"
                onClick={removeStage}
              >
                Remove <Minus className="w-4 h-4" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <DataTable
        tableKey="procedure-stage-executions"
        data={stage.executions!}
        noResults={
          <Button
            onClick={() =>
              setStage({
                ...stage,
                executions: [default_enabled_execution()],
              })
            }
            variant="secondary"
            disabled={disabled}
          >
            Add Execution
          </Button>
        }
        columns={[
          {
            header: "Execution",
            size: 250,
            cell: ({ row: { original, index } }) => (
              <ExecutionTypeSelector
                disabled={disabled}
                type={original.execution.type}
                onSelect={(type) =>
                  setStage({
                    ...stage,
                    executions: stage.executions!.map((item, i) =>
                      i === index
                        ? ({
                            ...item,
                            execution: {
                              type,
                              params:
                                TARGET_COMPONENTS[
                                  type as Types.Execution["type"]
                                ].params,
                            },
                          } as Types.EnabledExecution)
                        : item
                    ),
                  })
                }
              />
            ),
          },
          {
            header: "Target",
            size: 250,
            cell: ({
              row: {
                original: {
                  execution: { type, params },
                },
                index,
              },
            }) => {
              const Component = TARGET_COMPONENTS[type].Component;
              return (
                <Component
                  disabled={disabled}
                  params={params as any}
                  setParams={(params: any) =>
                    setStage({
                      ...stage,
                      executions: stage.executions!.map((item, i) =>
                        i === index
                          ? {
                              ...item,
                              execution: { type, params },
                            }
                          : item
                      ) as Types.EnabledExecution[],
                    })
                  }
                />
              );
            },
          },
          {
            header: "Add / Remove",
            size: 150,
            cell: ({ row: { index } }) => (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() =>
                    setStage({
                      ...stage,
                      executions: [
                        ...stage.executions!.slice(0, index + 1),
                        default_enabled_execution(),
                        ...stage.executions!.slice(index + 1),
                      ],
                    })
                  }
                  disabled={disabled}
                >
                  <PlusCircle className="w-4 h-4" />
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    setStage({
                      ...stage,
                      executions: stage.executions!.filter(
                        (_, i) => i !== index
                      ),
                    })
                  }
                  disabled={disabled}
                >
                  <MinusCircle className="w-4 h-4" />
                </Button>
              </div>
            ),
          },
          {
            header: "Enabled",
            size: 100,
            cell: ({
              row: {
                original: { enabled },
                index,
              },
            }) => {
              return (
                <Switch
                  checked={enabled}
                  onClick={() =>
                    setStage({
                      ...stage,
                      executions: stage.executions!.map((item, i) =>
                        i === index ? { ...item, enabled: !enabled } : item
                      ),
                    })
                  }
                  disabled={disabled}
                />
              );
            },
          },
        ]}
      />
    </Card>
  );
};

const new_stage = (next_index: number) => ({
  name: `Stage ${next_index}`,
  enabled: true,
  executions: [default_enabled_execution()],
});

const default_enabled_execution: () => Types.EnabledExecution = () => ({
  enabled: true,
  execution: {
    type: "None",
    params: {},
  },
});

const ExecutionTypeSelector = ({
  type,
  onSelect,
  disabled,
}: {
  type: Types.Execution["type"];
  onSelect: (type: Types.Execution["type"]) => void;
  disabled: boolean;
}) => {
  const execution_types = Object.keys(TARGET_COMPONENTS).filter(
    (c) => !["None"].includes(c)
  );

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = filterBySplit(execution_types, search, (item) => item);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" className="flex gap-2" disabled={disabled}>
          {fmt_upper_camelcase(type)}
          <ChevronsUpDown className="w-3 h-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] max-h-[200px] p-0" sideOffset={12}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search Executions"
            className="h-9"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty className="flex justify-evenly items-center pt-2">
              Empty.
              <SearchX className="w-3 h-3" />
            </CommandEmpty>
            <CommandGroup className="overflow-auto">
              {filtered.map((type) => (
                <CommandItem
                  key={type}
                  onSelect={() => onSelect(type as Types.Execution["type"])}
                  className="flex items-center justify-between"
                >
                  <div className="p-1">{fmt_upper_camelcase(type)}</div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

type ExecutionType = Types.Execution["type"];

type ExecutionConfigComponent<
  T extends ExecutionType,
  P = Extract<Types.Execution, { type: T }>["params"],
> = React.FC<{
  params: P;
  setParams: React.Dispatch<React.SetStateAction<P>>;
  disabled: boolean;
}>;

type MinExecutionType = Exclude<
  ExecutionType,
  | "StartContainer"
  | "RestartContainer"
  | "PauseContainer"
  | "UnpauseContainer"
  | "StopContainer"
  | "DestroyContainer"
  | "DeleteNetwork"
  | "DeleteImage"
  | "DeleteVolume"
  | "TestAlerter"
>;

type ExecutionConfigParams<T extends MinExecutionType> = Extract<
  Types.Execution,
  { type: T }
>["params"];

type ExecutionConfigs = {
  [ExType in MinExecutionType]: {
    Component: ExecutionConfigComponent<ExType>;
    params: ExecutionConfigParams<ExType>;
  };
};

const TARGET_COMPONENTS: ExecutionConfigs = {
  None: {
    params: {},
    Component: () => <></>,
  },
  // Procedure
  RunProcedure: {
    params: { procedure: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Procedure"
        selected={params.procedure}
        onSelect={(procedure) => setParams({ procedure })}
        disabled={disabled}
      />
    ),
  },
  BatchRunProcedure: {
    params: { pattern: "" },
    Component: ({ params, setParams, disabled }) => (
      <TextUpdateMenuMonaco
        title="Match procedures"
        value={
          params.pattern ||
          "# Match procedures by name, id, wildcard, or \\regex\\.\n"
        }
        onUpdate={(pattern) => setParams({ pattern })}
        disabled={disabled}
        language="string_list"
        fullWidth
      />
    ),
  },
  // Action
  RunAction: {
    params: { action: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Action"
        selected={params.action}
        onSelect={(action) => setParams({ action })}
        disabled={disabled}
      />
    ),
  },
  BatchRunAction: {
    params: { pattern: "" },
    Component: ({ params, setParams, disabled }) => (
      <TextUpdateMenuMonaco
        title="Match actions"
        value={
          params.pattern ||
          "# Match actions by name, id, wildcard, or \\regex\\.\n"
        }
        onUpdate={(pattern) => setParams({ pattern })}
        disabled={disabled}
        language="string_list"
        fullWidth
      />
    ),
  },
  // Build
  RunBuild: {
    params: { build: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Build"
        selected={params.build}
        onSelect={(build) => setParams({ build })}
        disabled={disabled}
      />
    ),
  },
  BatchRunBuild: {
    params: { pattern: "" },
    Component: ({ params, setParams, disabled }) => (
      <TextUpdateMenuMonaco
        title="Match builds"
        value={
          params.pattern ||
          "# Match builds by name, id, wildcard, or \\regex\\.\n"
        }
        onUpdate={(pattern) => setParams({ pattern })}
        disabled={disabled}
        language="string_list"
        fullWidth
      />
    ),
  },
  CancelBuild: {
    params: { build: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Build"
        selected={params.build}
        onSelect={(build) => setParams({ build })}
        disabled={disabled}
      />
    ),
  },
  // Deployment
  Deploy: {
    params: { deployment: "" },
    Component: ({ params, setParams, disabled }) => {
      return (
        <ResourceSelector
          type="Deployment"
          selected={params.deployment}
          onSelect={(deployment) => setParams({ deployment })}
          disabled={disabled}
        />
      );
    },
  },
  BatchDeploy: {
    params: { pattern: "" },
    Component: ({ params, setParams, disabled }) => (
      <TextUpdateMenuMonaco
        title="Match deployments"
        value={
          params.pattern ||
          "# Match deployments by name, id, wildcard, or \\regex\\.\n"
        }
        onUpdate={(pattern) => setParams({ pattern })}
        disabled={disabled}
        language="string_list"
        fullWidth
      />
    ),
  },
  PullDeployment: {
    params: { deployment: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Deployment"
        selected={params.deployment}
        onSelect={(deployment) => setParams({ deployment })}
        disabled={disabled}
      />
    ),
  },
  StartDeployment: {
    params: { deployment: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Deployment"
        selected={params.deployment}
        onSelect={(deployment) => setParams({ deployment })}
        disabled={disabled}
      />
    ),
  },
  RestartDeployment: {
    params: { deployment: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Deployment"
        selected={params.deployment}
        onSelect={(deployment) => setParams({ deployment })}
        disabled={disabled}
      />
    ),
  },
  PauseDeployment: {
    params: { deployment: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Deployment"
        selected={params.deployment}
        onSelect={(deployment) => setParams({ deployment })}
        disabled={disabled}
      />
    ),
  },
  UnpauseDeployment: {
    params: { deployment: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Deployment"
        selected={params.deployment}
        onSelect={(deployment) => setParams({ deployment })}
        disabled={disabled}
      />
    ),
  },
  StopDeployment: {
    params: { deployment: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Deployment"
        selected={params.deployment}
        onSelect={(id) => setParams({ deployment: id })}
        disabled={disabled}
      />
    ),
  },
  DestroyDeployment: {
    params: { deployment: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Deployment"
        selected={params.deployment}
        onSelect={(deployment) => setParams({ deployment })}
        disabled={disabled}
      />
    ),
  },
  BatchDestroyDeployment: {
    params: { pattern: "" },
    Component: ({ params, setParams, disabled }) => (
      <TextUpdateMenuMonaco
        title="Match deployments"
        value={
          params.pattern ||
          "# Match deployments by name, id, wildcard, or \\regex\\.\n"
        }
        onUpdate={(pattern) => setParams({ pattern })}
        disabled={disabled}
        language="string_list"
        fullWidth
      />
    ),
  },
  // Stack
  DeployStack: {
    params: { stack: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Stack"
        selected={params.stack}
        onSelect={(id) => setParams({ stack: id })}
        disabled={disabled}
      />
    ),
  },
  BatchDeployStack: {
    params: { pattern: "" },
    Component: ({ params, setParams, disabled }) => (
      <TextUpdateMenuMonaco
        title="Match stacks"
        value={
          params.pattern ||
          "# Match stacks by name, id, wildcard, or \\regex\\.\n"
        }
        onUpdate={(pattern) => setParams({ pattern })}
        disabled={disabled}
        language="string_list"
        fullWidth
      />
    ),
  },
  DeployStackIfChanged: {
    params: { stack: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Stack"
        selected={params.stack}
        onSelect={(id) => setParams({ stack: id })}
        disabled={disabled}
      />
    ),
  },
  BatchDeployStackIfChanged: {
    params: { pattern: "" },
    Component: ({ params, setParams, disabled }) => (
      <TextUpdateMenuMonaco
        title="Match stacks"
        value={
          params.pattern ||
          "# Match stacks by name, id, wildcard, or \\regex\\.\n"
        }
        onUpdate={(pattern) => setParams({ pattern })}
        disabled={disabled}
        language="string_list"
        fullWidth
      />
    ),
  },
  PullStack: {
    params: { stack: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Stack"
        selected={params.stack}
        onSelect={(id) => setParams({ stack: id })}
        disabled={disabled}
      />
    ),
  },
  StartStack: {
    params: { stack: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Stack"
        selected={params.stack}
        onSelect={(id) => setParams({ stack: id })}
        disabled={disabled}
      />
    ),
  },
  RestartStack: {
    params: { stack: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Stack"
        selected={params.stack}
        onSelect={(id) => setParams({ stack: id })}
        disabled={disabled}
      />
    ),
  },
  PauseStack: {
    params: { stack: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Stack"
        selected={params.stack}
        onSelect={(id) => setParams({ stack: id })}
        disabled={disabled}
      />
    ),
  },
  UnpauseStack: {
    params: { stack: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Stack"
        selected={params.stack}
        onSelect={(id) => setParams({ stack: id })}
        disabled={disabled}
      />
    ),
  },
  StopStack: {
    params: { stack: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Stack"
        selected={params.stack}
        onSelect={(id) => setParams({ stack: id })}
        disabled={disabled}
      />
    ),
  },
  DestroyStack: {
    params: { stack: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Stack"
        selected={params.stack}
        onSelect={(id) => setParams({ stack: id })}
        disabled={disabled}
      />
    ),
  },
  BatchDestroyStack: {
    params: { pattern: "" },
    Component: ({ params, setParams, disabled }) => (
      <TextUpdateMenuMonaco
        title="Match stacks"
        value={
          params.pattern ||
          "# Match stacks by name, id, wildcard, or \\regex\\.\n"
        }
        onUpdate={(pattern) => setParams({ pattern })}
        disabled={disabled}
        language="string_list"
        fullWidth
      />
    ),
  },
  // Repo
  CloneRepo: {
    params: { repo: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Repo"
        selected={params.repo}
        onSelect={(repo) => setParams({ repo })}
        disabled={disabled}
      />
    ),
  },
  BatchCloneRepo: {
    params: { pattern: "" },
    Component: ({ params, setParams, disabled }) => (
      <TextUpdateMenuMonaco
        title="Match repos"
        value={
          params.pattern ||
          "# Match repos by name, id, wildcard, or \\regex\\.\n"
        }
        onUpdate={(pattern) => setParams({ pattern })}
        disabled={disabled}
        language="string_list"
        fullWidth
      />
    ),
  },
  PullRepo: {
    params: { repo: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Repo"
        selected={params.repo}
        onSelect={(repo) => setParams({ repo })}
        disabled={disabled}
      />
    ),
  },
  BatchPullRepo: {
    params: { pattern: "" },
    Component: ({ params, setParams, disabled }) => (
      <TextUpdateMenuMonaco
        title="Match repos"
        value={
          params.pattern ||
          "# Match repos by name, id, wildcard, or \\regex\\.\n"
        }
        onUpdate={(pattern) => setParams({ pattern })}
        disabled={disabled}
        language="string_list"
        fullWidth
      />
    ),
  },
  BuildRepo: {
    params: { repo: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Repo"
        selected={params.repo}
        onSelect={(repo) => setParams({ repo })}
        disabled={disabled}
      />
    ),
  },
  BatchBuildRepo: {
    params: { pattern: "" },
    Component: ({ params, setParams, disabled }) => (
      <TextUpdateMenuMonaco
        title="Match repos"
        value={
          params.pattern ||
          "# Match repos by name, id, wildcard, or \\regex\\.\n"
        }
        onUpdate={(pattern) => setParams({ pattern })}
        disabled={disabled}
        language="string_list"
        fullWidth
      />
    ),
  },
  CancelRepoBuild: {
    params: { repo: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Repo"
        selected={params.repo}
        onSelect={(repo) => setParams({ repo })}
        disabled={disabled}
      />
    ),
  },
  // Server
  // StartContainer: {
  //   params: { server: "" },
  //   Component: ({ params, setParams, disabled }) => (
  //     <ResourceSelector
  //       type="Server"
  //       selected={params.server}
  //       onSelect={(server) => setParams({ server })}
  //       disabled={disabled}
  //     />
  //   ),
  // },
  // RestartContainer: {
  //   params: { server: "" },
  //   Component: ({ params, setParams, disabled }) => (
  //     <ResourceSelector
  //       type="Server"
  //       selected={params.server}
  //       onSelect={(server) => setParams({ server })}
  //       disabled={disabled}
  //     />
  //   ),
  // },
  // PauseContainer: {
  //   params: { server: "" },
  //   Component: ({ params, setParams, disabled }) => (
  //     <ResourceSelector
  //       type="Server"
  //       selected={params.server}
  //       onSelect={(server) => setParams({ server })}
  //       disabled={disabled}
  //     />
  //   ),
  // },
  // UnpauseContainer: {
  //   params: { server: "" },
  //   Component: ({ params, setParams, disabled }) => (
  //     <ResourceSelector
  //       type="Server"
  //       selected={params.server}
  //       onSelect={(server) => setParams({ server })}
  //       disabled={disabled}
  //     />
  //   ),
  // },
  // StopContainer: {
  //   params: { server: "" },
  //   Component: ({ params, setParams, disabled }) => (
  //     <ResourceSelector
  //       type="Server"
  //       selected={params.server}
  //       onSelect={(server) => setParams({ server })}
  //       disabled={disabled}
  //     />
  //   ),
  // },
  // DestroyContainer: {
  //   params: { server: "", container: "" },
  //   Component: ({ params, setParams, disabled }) => (
  //     <ResourceSelector
  //       type="Server"
  //       selected={params.server}
  //       onSelect={(server) => setParams({ server })}
  //       disabled={disabled}
  //     />
  //   ),
  // },
  StartAllContainers: {
    params: { server: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Server"
        selected={params.server}
        onSelect={(id) => setParams({ server: id })}
        disabled={disabled}
      />
    ),
  },
  RestartAllContainers: {
    params: { server: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Server"
        selected={params.server}
        onSelect={(id) => setParams({ server: id })}
        disabled={disabled}
      />
    ),
  },
  PauseAllContainers: {
    params: { server: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Server"
        selected={params.server}
        onSelect={(id) => setParams({ server: id })}
        disabled={disabled}
      />
    ),
  },
  UnpauseAllContainers: {
    params: { server: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Server"
        selected={params.server}
        onSelect={(id) => setParams({ server: id })}
        disabled={disabled}
      />
    ),
  },
  StopAllContainers: {
    params: { server: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Server"
        selected={params.server}
        onSelect={(id) => setParams({ server: id })}
        disabled={disabled}
      />
    ),
  },
  PruneContainers: {
    params: { server: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Server"
        selected={params.server}
        onSelect={(server) => setParams({ server })}
        disabled={disabled}
      />
    ),
  },
  PruneNetworks: {
    params: { server: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Server"
        selected={params.server}
        onSelect={(server) => setParams({ server })}
        disabled={disabled}
      />
    ),
  },
  PruneImages: {
    params: { server: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Server"
        selected={params.server}
        onSelect={(server) => setParams({ server })}
        disabled={disabled}
      />
    ),
  },
  PruneVolumes: {
    params: { server: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Server"
        selected={params.server}
        onSelect={(server) => setParams({ server })}
        disabled={disabled}
      />
    ),
  },
  PruneDockerBuilders: {
    params: { server: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Server"
        selected={params.server}
        onSelect={(server) => setParams({ server })}
        disabled={disabled}
      />
    ),
  },
  PruneBuildx: {
    params: { server: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Server"
        selected={params.server}
        onSelect={(server) => setParams({ server })}
        disabled={disabled}
      />
    ),
  },
  PruneSystem: {
    params: { server: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="Server"
        selected={params.server}
        onSelect={(server) => setParams({ server })}
        disabled={disabled}
      />
    ),
  },
  RunSync: {
    params: { sync: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="ResourceSync"
        selected={params.sync}
        onSelect={(id) => setParams({ sync: id })}
        disabled={disabled}
      />
    ),
  },
  CommitSync: {
    params: { sync: "" },
    Component: ({ params, setParams, disabled }) => (
      <ResourceSelector
        type="ResourceSync"
        selected={params.sync}
        onSelect={(id) => setParams({ sync: id })}
        disabled={disabled}
      />
    ),
  },

  Sleep: {
    params: { duration_ms: 0 },
    Component: ({ params, setParams, disabled }) => {
      const { toast } = useToast();
      const [internal, setInternal] = useState(
        params.duration_ms?.toString() ?? ""
      );
      useEffect(() => {
        setInternal(params.duration_ms?.toString() ?? "");
      }, [params.duration_ms]);
      return (
        <Input
          placeholder="Duration in milliseconds"
          value={internal}
          onChange={(e) => setInternal(e.target.value)}
          onBlur={() => {
            const duration_ms = Number(internal);
            if (duration_ms) {
              setParams({ duration_ms });
            } else {
              toast({
                title: "Duration must be valid number",
                variant: "destructive",
              });
            }
          }}
          disabled={disabled}
        />
      );
    },
  },
};
