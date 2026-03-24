export interface FileEntry {
	name: string;
	path: string;
	size: number;
	is_dir: boolean;
}

export interface DirectoryListing {
	entries: FileEntry[];
	total: number;
}

export interface FolderNode {
	name: string;
	path: string;
	files: FileEntry[];
	folders: FolderNode[];
	collapsed: boolean;
}

export interface OpenedProject {
	dir: string;
	name: string;
	files: FileEntry[];
	folders: FolderNode[];
	collapsed: boolean;
}
