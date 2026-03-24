/** Type declaration for Muya loaded via <script> in app.html */
declare module '/muya/index.min.js' {
	const Muya: any;
	export default Muya;
}

/** Type declaration for @marktext/file-icons (no official types) */
declare module '@marktext/file-icons' {
	const fileIcons: {
		getClassWithColor: (filename: string) => string;
		getClass: (filename: string) => string;
		matchName: (filename: string) => any;
		[key: string]: any;
	};
	export default fileIcons;
}
