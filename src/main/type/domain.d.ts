namespace Domain {
    type GroupProfile = {
        id: number;
        name: string;
    }

    type LibraryProfile = {
        id: number,
        name: string
    }

    type Library = {
        id: number;
        name: string;
        createTime?: string | undefined;
        modifiedTime?: string | undefined;
    }

    type LibraryExtra = {
        id: number;
        auxiliarySt: string;
        useAuxiliarySt: 0 | 1;
        intro: string;
    }

    type Record = {
        id: number;
        title: string;
        rate: number;
        cover: string | null;
        hyperlink: string | null;
        dirname: string | null;
        basename: string | null;
        createTime?: string | undefined;
        modifiedTime?: string | undefined;
    }












    type Author = {
        id: number;
        name: string;
        avatar: string | null;
        intro: string;
        createTime?: string;
        modifiedTime?: string;
    }
} 