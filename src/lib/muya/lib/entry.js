/**
 * MiraMD Muya entry point — imports Muya + all plugins and registers them.
 * This is the webpack entry instead of index.js.
 */
import Muya from './index'
import TablePicker from './ui/tablePicker'
import QuickInsert from './ui/quickInsert'
import CodePicker from './ui/codePicker'
import EmojiPicker from './ui/emojis'
import ImagePathPicker from './ui/imagePicker'
import ImageSelector from './ui/imageSelector'
import Transformer from './ui/transformer'
import ImageToolbar from './ui/imageToolbar'
import FormatPicker from './ui/formatPicker'
import FrontMenu from './ui/frontMenu'
import LinkTools from './ui/linkTools'
import FootnoteTool from './ui/footnoteTool'
import TableBarTools from './ui/tableTools'

// Register all plugins
Muya.use(TablePicker)
Muya.use(QuickInsert)
Muya.use(CodePicker)
Muya.use(EmojiPicker)
Muya.use(ImagePathPicker)
Muya.use(Transformer)
Muya.use(ImageToolbar)
Muya.use(FormatPicker)
Muya.use(FrontMenu)
Muya.use(LinkTools)
Muya.use(FootnoteTool)
Muya.use(TableBarTools)

export default Muya
