import TemplaterPlugin from "main";
import { errorWrapperSync } from "utils/Error";
import { get_fn_params, get_tfiles_from_folder, is_object } from "utils/Utils";
import documentation from "../../docs/documentation.toml";

const module_names = [
    "app",
    "config",
    "date",
    "file",
    "frontmatter",
    "hooks",
    "obsidian",
    "system",
    "user",
    "web",
] as const;
export type ModuleName = (typeof module_names)[number];
const module_names_checker: Set<string> = new Set(module_names);

export function is_module_name(x: unknown): x is ModuleName {
    return typeof x === "string" && module_names_checker.has(x);
}

export type TpDocumentation = {
    tp: {
        [key in ModuleName]: TpModuleDocumentation;
    };
};

export type TpModuleDocumentation = {
    name: string;
    queryKey: string;
    description: string;
    functions: {
        [key: string]: TpFunctionDocumentation;
    };
};

export type TpFunctionDocumentation = {
    name: string;
    queryKey: string;
    definition: string;
    description: string;
    example: string;
    args?: {
        [key: string]: TpArgumentDocumentation;
    };
};

export type TpArgumentDocumentation = {
    name: string;
    description: string;
};

export type TpSuggestDocumentation =
    | TpModuleDocumentation
    | TpFunctionDocumentation;

export function is_function_documentation(
    x: TpSuggestDocumentation
): x is TpFunctionDocumentation {
    if ((x as TpFunctionDocumentation).definition) {
        return true;
    }
    return false;
}

export class Documentation {
    public documentation: TpDocumentation = documentation;

    constructor(private plugin: TemplaterPlugin) {}

    get_all_modules_documentation(): TpModuleDocumentation[] {
        return Object.values(this.documentation.tp).map((mod) => {
            mod.queryKey = mod.name;
            return mod;
        });
    }

    get_all_functions_documentation(
        module_name: ModuleName,
        function_name: string
    ): TpFunctionDocumentation[] | undefined {
        if (module_name === "app") {
            return this.get_app_functions_documentation(
                this.plugin.app,
                function_name
            );
        }
        if (module_name === "user") {
            if (
                !this.plugin.settings ||
                !this.plugin.settings.user_scripts_folder
            )
                return;
            const files = errorWrapperSync(
                () =>
                    get_tfiles_from_folder(
                        this.plugin.app,
                        this.plugin.settings.user_scripts_folder
                    ),
                `User Scripts folder doesn't exist`
            );
            if (!files || files.length === 0) return;
            return files.reduce<TpFunctionDocumentation[]>(
                (processedFiles, file) => {
                    if (file.extension !== "js") return processedFiles;
                    return [
                        ...processedFiles,
                        {
                            name: file.basename,
                            queryKey: file.basename,
                            definition: "",
                            description: "",
                            example: "",
                        },
                    ];
                },
                []
            );
        }
        if (!this.documentation.tp[module_name].functions) {
            return;
        }
        return Object.values(this.documentation.tp[module_name].functions).map(
            (mod) => {
                mod.queryKey = mod.name;
                return mod;
            }
        );
    }

    private get_app_functions_documentation(
        obj: unknown,
        path: string
    ): TpFunctionDocumentation[] {
        if (!is_object(obj)) {
            return [];
        }
        const parts = path.split(".");
        if (parts.length === 0) {
            return [];
        }

        let currentObj = obj;
        for (let index = 0; index < parts.length - 1; index++) {
            const part = parts[index];
            if (part in currentObj) {
                if (!is_object(currentObj[part])) {
                    return [];
                }
                currentObj = currentObj[part];
            }
        }

        const definitionPrefix = [
            "tp",
            "app",
            ...parts.slice(0, parts.length - 1),
        ].join(".");
        const queryKeyPrefix = parts.slice(0, parts.length - 1).join(".");
        const docs: TpFunctionDocumentation[] = [];
        for (const key in currentObj) {
            const definition = `${definitionPrefix}.${key}`;
            const queryKey = queryKeyPrefix ? `${queryKeyPrefix}.${key}` : key;
            docs.push({
                name: key,
                queryKey,
                definition:
                    typeof currentObj[key] === "function"
                        ? `${definition}(${get_fn_params(
                              currentObj[key] as (...args: unknown[]) => unknown
                          )})`
                        : definition,
                description: "",
                example: "",
            });
        }

        return docs;
    }

    get_module_documentation(module_name: ModuleName): TpModuleDocumentation {
        return this.documentation.tp[module_name];
    }

    get_function_documentation(
        module_name: ModuleName,
        function_name: string
    ): TpFunctionDocumentation | null {
        return this.documentation.tp[module_name].functions[function_name];
    }

    get_argument_documentation(
        module_name: ModuleName,
        function_name: string,
        argument_name: string
    ): TpArgumentDocumentation | null {
        const function_doc = this.get_function_documentation(
            module_name,
            function_name
        );
        if (!function_doc || !function_doc.args) {
            return null;
        }
        return function_doc.args[argument_name];
    }
}
