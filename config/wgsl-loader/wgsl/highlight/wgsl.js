// This file was generated by lezer-generator. You probably shouldn't edit it.
import {LRParser} from "@lezer/lr"
import {untilEOLToken, untilCommentCloseToken} from "./tokens"
const spec_Identifier = {__proto__:null,enable:10, array:16, bool:18, f16:20, f32:22, i32:24, u32:26, vec2:28, vec3:30, vec4:32, vec2i:34, vec3i:36, vec4i:38, vec2u:40, vec3u:42, vec4u:44, vec2f:46, vec3f:48, vec4f:50, vec2h:52, vec3h:54, vec4h:56, ptr:58, function:60, private:62, workgroup:64, uniform:66, storage:68, read:70, write:72, read_write:74, mat2x2:80, mat2x3:82, mat2x4:84, mat3x2:86, mat3x3:88, mat3x4:90, mat4x2:92, mat4x3:94, mat4x4:96, atomic:98, sampler:100, sampler_comparison:102, texture_depth_2d:104, texture_depth_2d_array:106, texture_depth_cube:108, texture_depth_cube_array:110, texture_depth_multisampled_2d:112, texture_1d:114, texture_2d:116, texture_2d_array:118, texture_3d:120, texture_cube:122, texture_cube_array:124, texture_multisampled_2d:126, texture_storage_1d:128, texture_storage_2d:130, texture_storage_2d_array:132, texture_storage_3d:134, rgba8unorm:136, rgba8snorm:138, rgba8uint:140, rgba8sint:142, rgba16uint:144, rgba16sint:146, rgba16float:148, r32uint:150, r32sint:152, r32float:154, rg32uint:156, rg32sint:158, rg32float:160, rgba32uint:162, rgba32sint:164, rgba32float:166, asm:170, bf16:172, do:174, enum:176, f64:178, handle:180, i8:182, i16:184, i64:186, mat:188, premerge:190, regardless:192, typedef:194, u8:196, u16:198, u64:200, unless:202, using:204, vec:206, void:208, while:210, var:224, true:234, false:236, const:240, override:242, bitcast:248, type:300, struct:304, fn:314, return:326, if:328, else:330, switch:332, case:334, fallthrough:336, default:338, loop:340, continuing:344, for:346, let:348, break:374, continue:376, discard:378, import:382, use:390}
export const parser = LRParser.deserialize({
  version: 14,
  states: "!%rO!QQSOOP!XOSOOO!aQSO'#G}O!hQSO'#EmOOQO'#Gk'#GkO!mQSO'#ElO&eQSO'#EkO&yQSO'#EjOOQO'#Ej'#EjOOQO'#Ha'#HaOOQO'#Gj'#GjO'OQSO'#G}QOQSOOO'VQSO'#C_OOQO'#Gh'#GhO+yQSO'#GbO,RQSO'#GbP,WQTO'#C]P,]QUO'#C]POOO)CBo)CBoOOQO-E:f-E:fO,bQSO,5=iO,iQSO,5;XOOQO-E:i-E:iO0dQSO,5;VO0lQSO,5<XO1dQSO'#EoO1lQSO,5;cO1lQSO,5;cO1qQSO,5<RO1vQSO,5<TO1{QSO'#FnOOQO,5;U,5;UOOQO-E:h-E:hOOQO'#HY'#HYO2QQSO'#HYO2VQSO'#HYOOQO'#Cc'#CcOOQO'#Cb'#CbO3fQSO'#CcOOQO'#HZ'#HZOOQO'#H['#H[OOQO'#H]'#H]OOQO'#H^'#H^O3mQSO'#CcO3tQSO'#CcO2QQSO'#CcOOQO'#ES'#ESO3yQSO,58yO4RQSO'#GdOOQO,5<|,5<|O4WQWO,5<|O4]QSO,5<|POOO,58w,58wO5TQSO1G0sO5cQSO1G0qO:XQSO'#FsOOQO1G1s1G1sO:`QSO'#HfOOQO'#Eq'#EqO:qQWO'#ErOOQO,5;Z,5;ZO1lQSO,5;ZO:|QSO1G0}O;RQSO1G0}O;ZQSO1G1mO;cQSO1G1oO<ZQSO,5<YO<`QSO'#HPOOQO,5=t,5=tO?qQSO'#H_O<`QSO,5=rOOQO,58},58}O:`QSO'#HSO@uQSO1G.eO@|QSO1G.eOOQO1G.e1G.eOAUQWO'#GeOAaQSO,5=OO4RQSO,5=OOAiQSO1G2hO+|QSO1G2hOOQO'#Hd'#HdOAnQSO7+&_O5TQSO7+&_OOQO'#Hi'#HiOAvQSO'#HhOOQO'#Hh'#HhOOQO'#Et'#EtOOQO7+&]7+&]OOQO'#Gt'#GtOA{QSO'#I]OBZQWO'#I^OA{QSO'#I^OC_QWO'#I]OEWQWO'#I[OOQO'#Ft'#FtOEbQSO'#FtOOQO'#Gq'#GqOEgQSO,5<_OOQO,5<_,5<_OKWQSO'#IOOEnQSO'#IPOEnQSO'#IROK_QSO'#IVO1dQSO'#IZO1lQSO'#IZOKdQSO'#IWOOQO'#Ia'#IaOKiQSO,5>QOOQO'#HT'#HTO<`QSO,5;^OOQO1G0u1G0uO5cQSO7+&iOEnQSO7+&iO<`QSO7+'XOKqQSO'#FkOOQO7+'Z7+'ZOK|QSO1G1tOLXQSO,5=kOL^QSO,5=yOOQO'#H`'#H`OLcQSO1G3^OLkQSO,5=nOOQO,5=T,5=TOOQO7+$P7+$POLpQSO7+$POOQO-E:g-E:gOLwQSO,5=POL|QSO1G2jOOQO1G2j1G2jOMUQSO1G2jOOQO-E:s-E:sOOQO7+(S7+(SOOQO,5=W,5=WOOQO<<Iy<<IyOM^QSO<<IyOOQO-E:j-E:jOMfQSO,5>SOOQO-E:r-E:rOOQO'#I^'#I^OMmQWO,5>wONqQSO'#HrONxQSO,5<`ON}QSO,5>xO! SQSO'#FPOEnQSO'#HtO! sQWO'#HtOOQO,5>w,5>wOOQO'#I_'#I_OEnQSO,5>vOOQO,5<`,5<`OOQO-E:o-E:oOOQO1G1y1G1yO!#hQ`O'#CcOEnQSO'#HsOOQO'#Hq'#HqO!$nQSO'#HqO!%_Q`O'#HpOOQO'#Ho'#HoOEnQSO'#HoO!'xQ`O'#HnO!(}Q`O'#HmO!)|Q`O'#HlO!*jQ`O'#HkO!+eQSO'#HvO!+|QSO'#HjO!,RQSO'#HjO!,WQSO'#HjO!,]QSO'#HjO!,bQSO'#HjO2QQSO'#HqOOQO,5>j,5>jO:SQSO,5>kO!,gQSO,5>mO!,lQSO,5>qO!,vQSO,5>uO1lQSO,5>uO!-OQSO,5>uO!-fQSO,5>rOOQO1G3l1G3lO!-pQSO1G3lOOQO1G0x1G0xOOQO<<JT<<JTOOQO'#Ez'#EzOOQO<<Js<<JsO! SQSO'#FlO!-{QSO,5<VO!.TQSO,5<VOOQO,5<V,5<VO!.]QSO'#FqO!.bQSO'#FpO!.TQSO'#FpO!.jQSO7+'`OOQO1G3V1G3VO!-pQSO1G3eOOQO7+(x7+(xO!.oQSO7+(xO<`QSO1G3YOOQO<<Gk<<GkP'VQSO'#GiOOQO1G2k1G2kOOQO7+(U7+(UO!.zQSO7+(UP!/SQSO'#GuOOQOAN?eAN?eP!/XQSO'#GlO!/^QSO1G3nO5cQSO1G3nOOQO1G3n1G3nOOQO1G4c1G4cO!/fQSO,5>^OEnQSO,5>^OOQO,5>^,5>^OOQO1G1z1G1zOOQO1G4d1G4dOOQO'#FQ'#FQOOQO,5;k,5;kO!/nQSO,5>`OOQO,5>`,5>`OOQO1G4b1G4bO!/sQSO,5>_OOQO,5>],5>]O!/xQ`O'#HtOOQO,5>[,5>[OOQO,5>Z,5>ZOEnQSO,5>WOEnQSO,5>YOEnQSO,5>XOEnQSO,5>VOEnQSO,5>bOEnQSO,5>cOEnQSO,5>dOEnQSO,5>eOEnQSO,5>fOKRQSO,5>]O!1RQSO1G4VO!2cQSO1G4XO!2kQSO1G4]O:SQSO'#F}OOQO1G4]1G4]O!2uQSO1G4]OEnQSO1G4aO!2zQSO1G4aO!3SQWO'#I^ODcQWO'#I[OOQO'#IY'#IYO!4QQSO'#IXO!4XQSO'#IXO!4^QSO1G4^O!4cQSO7+)WOOQO'#HV'#HVO!4hQWO,5<WO!4mQSO1G1qOOQO1G1q1G1qO!4xQSO1G1qOOQO-E:m-E:mO!5QQWO,5<]O!5VQSO,5=[O!5bQSO,5<[OOQO-E:n-E:nO!5jQpO<<JzO!6eQSO7+)POOQO'#HX'#HXO!6jQSO<<LdO!6oQSO7+(tOOQO<<Kp<<KpPOQO,5=a,5=aO!:iQSO7+)YOOQO7+)Y7+)YO!:pQSO7+)YOOQO-E:k-E:kO!@bQSO1G3xOOQO1G3x1G3xO!@iQSO1G3xOOQO-E:l-E:lO!A]QWO1G3zOOQO1G3y1G3yOOQO1G3r1G3rOOQO1G3t1G3tOOQO'#Hn'#HnO!CTQ`O1G3sO!DcQ`O'#HnO!(VQSO'#HmO!DmQSO'#HlOOQO1G3q1G3qO!EYQSO1G3|O!EaQSO1G3}O!EhQSO1G4OO!EoQSO1G4PO!EvQSO1G4QOOQO1G3w1G3wO!E}QSO7+)qOOQO'#Gr'#GrO!FVQSO7+)sO!FbQSO'#ISO!FsQWO'#ISOOQO7+)w7+)wO!FxQSO7+)wOOQO,5<i,5<iOOQO7+){7+){OEnQSO7+){OOQO,5>t,5>tO!F}QSO,5>sO!G`QSO,5>sO!GeQSO,5>sO:SQSO7+)xOOQO<<Lr<<LrO<`QSO1G1rOOQO7+']7+']O!GlQSO7+']P!GwQSO'#GoO<`QSO1G1wO!G|QSO1G1vP!HXQSO'#GpO!H^QSO'#FrOOQOAN@fAN@fOOQO<<Lk<<LkOOQOANBOANBOOOQO<<L`<<L`O!-pQSO<<L`OOQO<<Lt<<LtO!KrQSO<<LtP!KyQSO'#GmOOQO7+)d7+)dO!LOQSO7+)dP!LVQSO'#GnOOQO7+)f7+)fO!L[Q`O1G3zOOQO'#IQ'#IQOOQO<<M]<<M]OOQO-E:p-E:pOOQO<<M_<<M_O!MeQWO'#ITO!FbQSO'#ITO!MmQWO,5>nO!MrQSO,5>nOOQO<<Mc<<McOOQO<<Mg<<MgOBZQWO'#I^O!MwQWO'#I`OOQO'#I`'#I`OOQO1G4_1G4_O!NRQSO1G4_O!NdQSO1G4_OOQO<<Md<<MdOOQO7+'^7+'^OOQO<<Jw<<JwPOQO,5=Z,5=ZOOQO7+'c7+'cPOQO,5=[,5=[O<`QSO,5<^O!NiQSOANAzOOQOANB`ANB`POQO,5=X,5=XOOQO<<MO<<MOPOQO,5=Y,5=YO!!sQWO'#CcO!NnQWO'#HpO!B]QSO1G3sO# WQpO,5=_O# _QWO,5>oOOQO-E:q-E:qO# gQSO1G4YO# lQSO1G4YOOQO,5>z,5>zOOQO7+)y7+)yO# vQSO7+)yOOQO1G1x1G1xOOQOG27fG27fO#!XQpO1G4ZP#!`QSO'#GsO#!eQSO7+)tO#!oQSO'#IUO#!yQSO'#IUOOQO7+)t7+)tO##OQSO7+)tOOQO<<Me<<MePOQO,5=_,5=_OOQO<<M`<<M`O##TQSO<<M`OOQO,5>p,5>pOOQOANBzANBzO##YQSO'#HoO#(eQSO,5>`O##YQSO,5>WOEnQSO,5>XO!&hQ`O'#HnOEnQSO'#Ht",
  stateData: "#(s~O%nOS%oPQ%pPQ~OT]O%V_O%Z`O%rXO&URO#d#`P#l#`P#m#`P$[#`P$^#`P$c#`P~O%j%qP~P]O%oaO%pbO~O%j%qX~P]OSfO~O&URO#d#`X#l#`X#m#`X$[#`X$^#`X$c#`XS#`XW#`XX#`XY#`XZ#`X[#`X]#`X^#`X_#`X`#`Xa#`Xb#`Xc#`Xd#`Xe#`Xf#`Xg#`Xh#`Xi#`Xj#`Xk#`Xl#`Xm#`Xx#`Xy#`Xz#`X{#`X|#`X}#`X!O#`X!P#`X!Q#`X!R#`X!S#`X!T#`X!U#`X!V#`X!W#`X!X#`X!Y#`X!Z#`X![#`X!]#`X!^#`X!_#`X!`#`X!a#`X!b#`X!c#`X!d#`X!e#`X~O#djO#lkO#mlO$[mO$^nO$coO~O%rpO~O%j%qX~P`OSuOWwOXuOYuOZuO[uO]uO^|O_|O`|OauObuOcuOduOeuOfuOguOhuOiuOjuOkuOluOm}Ox|Oy|Oz|O{|O||O}|O!O|O!P|O!Q|O!R!OO!SxO!TxO!UyO!VyO!WyO!XyO!YyO!ZzO![zO!]zO!^zO!_zO!`zO!asO!b{O!c{O!d{O!e{O!w!PO!x!PO!y!PO!z!PO!{!PO!|!PO!}!PO#O!PO#P!PO#Q!PO#R!PO#S!PO#T!PO#U!PO#V!PO#W!PO#X!PO#Y!PO#Z!PO#[!PO#]!PO~O%Y!SO&p!RO~O%Y!UO~O%k!VO~O%l!VO~O%j%qa~P`O&V!WO#d#aa#l#aa#m#aa$[#aa$^#aa$c#aa&U#aaS#aaW#aaX#aaY#aaZ#aa[#aa]#aa^#aa_#aa`#aaa#aab#aac#aad#aae#aaf#aag#aah#aai#aaj#aak#aal#aam#aax#aay#aaz#aa{#aa|#aa}#aa!O#aa!P#aa!Q#aa!R#aa!S#aa!T#aa!U#aa!V#aa!W#aa!X#aa!Y#aa!Z#aa![#aa!]#aa!^#aa!_#aa!`#aa!a#aa!b#aa!c#aa!d#aa!e#aa~O#g!XO%r#_a~O&p!YO#d$aa#l$aa#m$aa$[$aa$^$aa$c$aa%V$aa%Z$aa%j$aa%r$aa&U$aa~OS!^O%t![O~OS!^O~OS!cO~OS!dO~OS!eO~O%t!fO~O%t!hO~O%rVX%xVX&VVX%uVX#gVX&oVX&XVX#dVX#lVX#mVX$[VX$^VX$cVX%VVX%ZVX%jVX&UVX&pVX~O%t!iO~P2[O%t!fO~P2[O%t!kO~O%r!nO%x!lO~OS!oO~O'V!rO~O'W!sO#d%Ua#l%Ua#m%Ua$[%Ua$^%Ua$c%Ua%V%Ua%Z%Ua%j%Ua%r%Ua&U%Ua~OS!tOv!tOw!tO#b!tO~OSuOWwOXuOYuOZuO[uO]uO^|O_|O`|OauObuOcuOduOeuOfuOguOhuOiuOjuOkuOluOm}Ov!wOw!wOx|Oy|Oz|O{|O||O}|O!O|O!P|O!Q|O!R!OO!SxO!TxO!UyO!VyO!WyO!XyO!YyO!ZzO![zO!]zO!^zO!_zO!`zO!asO!b{O!c{O!d{O!e{O#b!wO#i!wO#j!wO~OS#OO#d#]O#x!|O#y!|O$i#XO$j#YO$l#ZO$p#[O$s#_O$t#^O%R#`O%S#`O%T#`O%r#SO&V#PO&p!YO~O&o#WO~P9TOn#bOo#bOp#bOq#bOr#bO~O&Z#cO#g#fX%r#fX~O#g#eO~O#g#fO%r#ki~O#g#gO%r$Zi~O&p#hO#d$]i#l$]i#m$]i$[$]i$^$]i$c$]i%V$]i%Z$]i%j$]i%r$]i&U$]i~O&V#jO~OSuOWwOXuOYuOZuO[uO]uO^|O_|O`|OauObuOcuOduOeuOfuOguOhuOiuOjuOkuOluOm}Ox|Oy|Oz|O{|O||O}|O!O|O!P|O!Q|O!R!OO!SxO!TxO!UyO!VyO!WyO!XyO!YyO!ZzO![zO!]zO!^zO!_zO!`zO!asO!b{O!c{O!d{O!e{O~O!f#mO!g#mO!h#mO!i#mO!j#mO!k#mO!l#mO!m#mO!n#mO!o#mO!p#mO!q#mO!r#mO!s#mO!t#mO!u#mO~O%r#qO~P'VO%r#qO%x#rO~O'U#tO%x%XX&o%XX~O%x#uO&o#vO~O%Y#yO~O%x#zO&X#{O~O&V$OO~OS$QO#x!|O#y!|O&V#PO~O&V$SO#g'QX#q'QX$u'QX$v'QX$w'QX$x'QX$y'QX$z'QX${'QX$|'QX$}'QX%O'QX%P'QX%Q'QX&i'QX~O#q$WO&i$VO#g'PX$u'PX$v'PX$w'PX$x'PX$y'PX$z'PX${'PX$|'PX$}'PX%O'PX%P'PX%Q'PX&X'PX~O#g$[O$u$ZO$v$ZO$w$ZO$x$ZO$y$ZO$z$ZO${$ZO$|$ZO$}$ZO%O$ZO~O%P$TO%Q$TO~PDcO%r$]O~O&o$_O~P9TOS$`OWwOXuOYuOZuO[uO]uO^|O_|O`|OauObuOcuOduOeuOfuOguOhuOiuOjuOkuOluOm}Ov!wOw!wOx|Oy|Oz|O{|O||O}|O!O|O!P|O!Q|O!R!OO!SxO!TxO!UyO!VyO!WyO!XyO!YyO!ZzO![zO!]zO!^zO!_zO!`zO!asO!b{O!c{O!d{O!e{O!w!PO!x!PO!y!PO!z!PO!{!PO!|!PO!}!PO#O!PO#P!PO#Q!PO#R!PO#S!PO#T!PO#U!PO#V!PO#W!PO#X!PO#Y!PO#Z!PO#[!PO#]!PO#b!wO#i!wO#j!wO#p$qO#u$fO#v$fO#w$fO#x$fO#y$fO&V$aO~O%r&rX~PEnO&p$uO~O&V$yO~O%u$zO%x${O~O&URO&o%TOS#`P~O&UROS#`P&X$dP~O%u%YO~O%x%ZO~O%u%[O%x%]O~O%x%^O~O%r%_O~P'VOS%aO~O&o%bOS%ia~O%x%cO&o%bO~O%x#zO&X%eO~O&X%iO~P5cO#q$WO&i$VO#g'Pa$u'Pa$v'Pa$w'Pa$x'Pa$y'Pa$z'Pa${'Pa$|'Pa$}'Pa%O'Pa%P'Pa%Q'Pa&X'Pa~O&X%mO~PEnO%r%nO~O&X%oO~OS%pO~O&i$VO&X&hX$V&hX$W&hX%r&hX&p&hX%x&hX#r&hX~O#q$WO#g&hX$u&hX$v&hX$w&hX$x&hX$y&hX$z&hX${&hX$|&hX$}&hX%O&hX%P&hX%Q&hX~P! XO#q&eX$V&eX$W&eX%r&eX&VVX&V#oX&i&eX&p&eX%x&eX&X&eX#r&eX~O#u&eX#x&eX#y&eX#z&eX#{&eX#|&eX#}&eX$O&eX$P&eX$Q&eX$R&eX$S&eX$T&eX$U&eX$X&eX$Y&eX~P!!sO&V$SO~O&i$VO$V&dX$W&dX%r&dX&p&dX%x&dX&X&dX#r&dX~O#q)dO#u&dX#x&dX#y&dX#z&dX#{&dX#|&dX#}&dX$O&dX$P&dX$Q&dX$R&dX$S&dX$T&dX$U&dX$X&dX$Y&dX~P!$sO#}%zO$O%zO#u&bX#x&bX#z&bX#{&bX#|&bX$P&bX$Q&bX$R&bX$S&bX$T&bX$U&bX$V&bX$W&bX%r&bX&p&bX%x&bX&X&bX#r&bX~O#y&lX$X&mX$Y&nX~P!&hO#x%{O#z%{O#{%{O#u&aX#|&aX$V&aX$W&aX%r&aX&p&aX%x&aX&X&aX#r&aX~O$P&aX$Q&aX$R&aX$S&aX$T&aX$U&aX~P!(VO$V&`X$W&`X%r&`X&p&`X%x&`X&X&`X#r&`X~O#u%|O#|%|O$P&`X$Q&`X$R&`X$S&`X$T&`X$U&`X~P!)eO$P%}O$Q%}O$R%}O$S%}O$T%}O$U%}O$V&_X$W&_X%r&_X&p&_X%x&_X&X&_X#r&_X~O$V&jX$W&kX%r&^X&p&^X%x&^X&X&^X#r&^X~O$V&OO~O$W&PO~O#y&QO~O$X&RO~O$Y&SO~O&p&VO~O$r&XO&o&YO~P9TO#g&[O%r&}a~O#g&[O~O#d#]O#x!|O#y!|O$t#^O&V#PO~OS&^O%r&aO~P!-TOs&eOt&eOu&eO~O%x&gO&o&hO~O&UROS#`P~OS&kO~O%x&lO&X$dX~O&X&oO~OS&qOv&qOw&qO~O&o&tOS%ia~O%x&uO~O%x#zO~O%x&vO&X&wO~O%x&zO&X&{O~O#r'OO~O&X'PO~O#q)dO#u&hX#x&hX#y&hX#z&hX#{&hX#|&hX#}&hX$O&hX$P&hX$Q&hX$R&hX$S&hX$T&hX$U&hX$X&hX$Y&hX~P! XO$k'`OS&si#d&si#x&si#y&si$i&si$j&si$l&si$p&si$s&si$t&si%R&si%S&si%T&si%r&si&V&si&o&si&p&si$r&si$n&si~O$m'cO$o'dO~O$r&XO&o'eO~P9TO&o'eO~O#g'iO%r&}i~O&V$SO#g'QX#q'QX$u'QX$v'QX$w'QX$x'QX$y'QX$z'QX${'QX$|'QX$}'QX%O'QX&i'QX~O%r'kO~PEnO%r'mO~O&X'nO~O%u'oO~O&Z'pO~O&o'qOS%ca&U%ca~O%x'rO&o'qO~O&Z'tO~OS%da&U%da&X$da~O%x'uO&X$da~O&q'wO#d$fP#l$fP#m$fP$[$fP$^$fP$c$fP%V$fP%Z$fP%j$fP%r$fP&U$fP&p$fP~O%u'yO~O%u'zO~O%u'{O%x'|O~OS%aaW%aaX%aaY%aaZ%aa[%aa]%aa^%aa_%aa`%aaa%aab%aac%aad%aae%aaf%aag%aah%aai%aaj%aak%aal%aam%aav%aaw%aax%aay%aaz%aa{%aa|%aa}%aa!O%aa!P%aa!Q%aa!R%aa!S%aa!T%aa!U%aa!V%aa!W%aa!X%aa!Y%aa!Z%aa![%aa!]%aa!^%aa!_%aa!`%aa!a%aa!b%aa!c%aa!d%aa!e%aa#b%aa#i%aa#j%aa~O&X'}O~P!6wO%x(OO&X'}O~OS%baW%baX%baY%baZ%ba[%ba]%ba^%ba_%ba`%baa%bab%bac%bad%bae%baf%bag%bah%bai%baj%bak%bal%bam%bav%baw%bax%bay%baz%ba{%ba|%ba}%ba!O%ba!P%ba!Q%ba!R%ba!S%ba!T%ba!U%ba!V%ba!W%ba!X%ba!Y%ba!Z%ba![%ba!]%ba!^%ba!_%ba!`%ba!a%ba!b%ba!c%ba!d%ba!e%ba!w%ba!x%ba!y%ba!z%ba!{%ba!|%ba!}%ba#O%ba#P%ba#Q%ba#R%ba#S%ba#T%ba#U%ba#V%ba#W%ba#X%ba#Y%ba#Z%ba#[%ba#]%ba#b%ba#i%ba#j%ba#p%ba#u%ba#v%ba#w%ba#x%ba#y%ba&V%ba~O&X(QO~P!:xO%x(RO&X(QO~O&i$VO&X&hi$V&hi$W&hi%r&hi&p&hi%x&hi#r&hi~O#q$WO#g&hi$u&hi$v&hi$w&hi$x&hi$y&hi$z&hi${&hi$|&hi$}&hi%O&hi%P&hi%Q&hi~P!@qO#x%{O#z%{O#{%{O#u&ai#|&ai$V&ai$W&ai%r&ai&p&ai%x&ai&X&ai#r&ai~O$P&ai$Q&ai$R&ai$S&ai$T&ai$U&ai~P!B]O#u&bX#x&bX#z&bX#{&bX#|&bX$V&bX$W&bX%r&bX&p&bX%x&bX&X&bX#r&bX~O#})aO$O)aO~P!CkO#u)bO#|)bO~P!)eO%r&^i&p&^i%x&^i&X&^i#r&^i~O$V&ji~P!DwO$W&ki~P!DwO#y&li~P!DwO$X&mi~P!DwO$Y&ni~P!DwO$j#YO&p!YO~O$m'cO$o'dO&o(YO~Ov!wOw!wO#b!wO#i!wO#j!wO~O&Z(^O~O&o(_O~OS(aO#x!|O#y!|O&V#PO&X&{a~O%r(eO~O%r(eO~PEnO&o(iOS%ca&U%ca~O%x(jO~OS%da&U%da&X$di~O%x(lO~O&UROS#`PW#`PX#`PY#`PZ#`P[#`P]#`P^#`P_#`P`#`Pa#`Pb#`Pc#`Pd#`Pe#`Pf#`Pg#`Ph#`Pi#`Pj#`Pk#`Pl#`Pm#`Px#`Py#`Pz#`P{#`P|#`P}#`P!O#`P!P#`P!Q#`P!R#`P!S#`P!T#`P!U#`P!V#`P!W#`P!X#`P!Y#`P!Z#`P![#`P!]#`P!^#`P!_#`P!`#`P!a#`P!b#`P!c#`P!d#`P!e#`P~O&X(oO~P!6wO%x(pO~O&X(qO~P!:xO%x(rO~O#q)dO#u&hi#x&hi#y&hi#z&hi#{&hi#|&hi#}&hi$O&hi$P&hi$Q&hi$R&hi$S&hi$T&hi$U&hi$X&hi$Y&hi~P!@qO%x(vO&Z&wX~O&Z(yO~O&p(zO~O%P({O%Q({O~PDcOS(aO#x!|O#y!|O&V#PO&X&{i~O%r(}O~O%u)PO~O#q$WO~P!$sOv%gaw%ga#b%ga#i%ga#j%ga~O&Z&wa~P!NuO%x)QO&Z&wa~O&p)SO~O$n)UO&o)VO~P9TOS(aO#x!|O#y!|O&V#PO&X&{q~O&Z&wi~P!NuO%x)YO~O$n)UO&o)ZO~P9TO$n)UO&o&xX~P9TO%r)]O~O&o)ZO~O&o)^O~OS(sOWwOXuOYuOZuO[uO]uO^|O_|O`|OauObuOcuOduOeuOfuOguOhuOiuOjuOkuOluOm}Ox|Oy|Oz|O{|O||O}|O!O|O!P|O!Q|O!R!OO!SxO!TxO!UyO!VyO!WyO!XyO!YyO!ZzO![zO!]zO!^zO!_zO!`zO!asO!b{O!c{O!d{O!e{O!w!PO!x!PO!y!PO!z!PO!{!PO!|!PO!}!PO#O!PO#P!PO#Q!PO#R!PO#S!PO#T!PO#U!PO#V!PO#W!PO#X!PO#Y!PO#Z!PO#[!PO#]!PO#p$qO#u)_O#v)_O#w)_O#x)_O#y)_O&V$aO~P!FbO#r(UO~O%o#z#bwv#uSw~",
  goto: "BV'UP'VP'YPP'^'fPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP(yPPPPPPPPPPPPPPPPPPPPP)n)t)z*]P*iP*l*rP+XPP)tPP+_+hPPP,V,cPPPPPPPPPPPPPPPPPPPP)tP,iP,o,r,i,xP,{-O-U-X-qPPPPPPPP-|PPPPPPPPPPPPPPPPPP)nP.S.YPP.`.f.l.v/U/[/b/h/n/t0O0U0[0mPPPPPPP0sP0vPP1Q1TP1Z1d2c1d2f2f3e4d5c5f5iPP5oP5uP5y6T7O7v8^8s9Y9u:v;e<U<b=SP=f=v>W>h>xPPP?Y?c?o?r?{@P@S?r?r@]@`@c@oAQAfAwA|?YRcPT^OQQ!Q]V#p!l#r%`Wv]!l#r%`W!x!X#e$O%hQ#k!fQ#n!i!W$c#X#Y#Z#f$S$W$[$a$f%l%z%{%|%}&O&P&Q&R&S&[&a'i'm)_)a)b)dQ$|#cQ%P#gQ&s%^Q(h'pQ(k'tR)O(mWv]!l#r%`!X$b#X#Y#Z#f$S$W$[$a$f%l%z%{%|%}&O&P&Q&R&S&[&a'i'm)_)a)b)dXXOQZeXVOQZeWUOQZeS%Q#h%SS%U#j%WR(m'weSOQTZe#h#j%S%W'wRhUQ!`jR$w#]Q!_jQ!akQ!blQ#d!`Q$v#]Q$x#^R&]$wQ!{!XR$}#eQ$}#fQ'h&[R(`'i!X$c#X#Y#Z#f$S$W$[$a$f%l%z%{%|%}&O&P&Q&R&S&[&a'i'm)_)a)b)dY$X#Q$R$X'O(tV%w$d%w(UQ%q$VR&f%QXWOQZeR#i!dQ%R#hR&i%SRiUR%X#jQ%V#jR&m%WR'x&oQ!Zi^#S!Y#V$u&W(z)S)TQ&U$sQ'g&XQ(V'`R(g'nW#U!Y#V$u&WV)T(z)S)TQ&Z$uR'f&WQ!T_R#y!sQ!p!RR#w!qQQORdQQ!m!QR#s!mQZOQeQTqZebTOQZe#h#j%S%W'wRgTQ!v!WR#}!vQ%h$OR&y%hQ%l$SR&}%lQ%S#hR&j%SQ%W#jR&n%WQ#V!YS$^#V&WR&W$uQ'b&VR(X'bQ(['cR(x([h!}!Y#P#V$u$y&W'k(e(z(})S)TR$P!}Q!q!RR#x!qR[OQ!gsS!j|!OR&T$qR!j}Q#a![R#o!kQ&d${Q&p%ZR(n'|!yu]!X!f!i!l#X#Y#Z#c#e#f#g#r$O$S$W$[$a$f%^%`%h%l%z%{%|%}&O&P&Q&R&S&[&a'i'm'p't(m)_)a)b)dR&r%]!yr]!X!f!i!l#X#Y#Z#c#e#f#g#r$O$S$W$[$a$f%^%`%h%l%z%{%|%}&O&P&Q&R&S&[&a'i'm'p't(m)_)a)b)d!ys]!X!f!i!l#X#Y#Z#c#e#f#g#r$O$S$W$[$a$f%^%`%h%l%z%{%|%}&O&P&Q&R&S&[&a'i'm'p't(m)_)a)b)d!yt]!X!f!i!l#X#Y#Z#c#e#f#g#r$O$S$W$[$a$f%^%`%h%l%z%{%|%}&O&P&Q&R&S&[&a'i'm'p't(m)_)a)b)dR!gtR#l!hXYOQZeQ!u!WR#|!vT!]j#]S!z!X#eQ%g$OR&x%hW!y!X#e$O%h!W$b#X#Y#Z#f$S$W$[$a$f%l%z%{%|%}&O&P&Q&R&S&[&a'i'm)_)a)b)dQ(Z'cR(w([Q$r#XQ$s#YQ$t#ZU%O#f&['iQ%k$SQ%r$WQ%t$[Q%u$aQ&|%lQ'l&aQ(f'mR)`)dl$k#X#Y#Z#f$S$W$[$a%l&[&a'i'm)dQ'Y&OR'Z&Pp$j#X#Y#Z#f$S$W$[$a%l&O&P&[&a'i'm)dR'X%}p$i#X#Y#Z#f$S$W$[$a%l&O&P&[&a'i'm)dR'W%}p$h#X#Y#Z#f$S$W$[$a%l&O&P&[&a'i'm)dQ'T%|Q'V%}R(u)bl$g#X#Y#Z#f$S$W$[$a%l&[&a'i'm)dS%y$f)_S'Q%z)aQ'R%{S'S%|)bQ'U%}Q'[&QQ']&RQ'^&ST)c&O&P!X$e#X#Y#Z#f$S$W$[$a$f%l%z%{%|%}&O&P&Q&R&S&[&a'i'm)_)a)b)d!S$d#X#Y#Z#f$S$W$[$a$f%l%z%{%|%}&O&P&Q&R&S&[&a'i'm)b)dT(t)_)aQ$T#OQ%v$cQ'j&^R({(a!W$b#X#Y#Z#f$S$W$[$a$f%l%z%{%|%}&O&P&Q&R&S&[&a'i'm)_)a)b)dR'_&TQ$Y#QQ%j$RS%s$X%wS%x$d(tT(T'O(Um$l#X#Y#Z#f$S$W$[$a%l&[&a'i'm)dm$m#X#Y#Z#f$S$W$[$a%l&[&a'i'm)dm$n#X#Y#Z#f$S$W$[$a%l&[&a'i'm)dm$o#X#Y#Z#f$S$W$[$a%l&[&a'i'm)dm$p#X#Y#Z#f$S$W$[$a%l&[&a'i'm)d_#T!Y#V$u&W(z)S)T^#S!Y#V$u&W(z)S)TR(V'`R(W'`_#S!Y#V$u&W(z)S)TT'a&V'bR(]'cQ)W(zQ)[)SR)])TR&c$yR&b$y^#T!Y#V$u&W(z)S)TR&`$y^#T!Y#V$u&W(z)S)TQ&`$yV(c'k(e(}^#R!Y#V$u&W(z)S)TQ$U#PQ&_$yV(b'k(e(}h#Q!Y#P#V$u$y&W'k(e(z(})S)TR$R!}V$[#R&_(bQ(d'kQ(|(eR)X(}",
  nodeNames: "⚠ Comment Program EnableDirective Identifier Directive EnableExtension TypeDeclaration Type Type Type Type Type Type Type Type Type Type Type Type Type Type Type Type Type Type Type Type Type Type Keyword Keyword Keyword Keyword Keyword Keyword Keyword Keyword IntLiteral UintLiteral Type Type Type Type Type Type Type Type Type Type Type Type Keyword Keyword Keyword Keyword Keyword Type Type Type Type Type Type Keyword Type Type Type Type Type Type Type Type Type Type Type Type Type Type Type Type Type Type Type Type Reserved Reserved Reserved Reserved Reserved Reserved Reserved Reserved Reserved Reserved Reserved Reserved Reserved Reserved Reserved Reserved Reserved Reserved Reserved Reserved Reserved Reserved LocalDeclaration GlobalVariableDeclaration AttributeList Attribute FloatLiteral GlobalVariable Keyword VariableQualifier VariableIdentifier Assign Value Boolean Boolean GlobalConstantDeclaration Keyword Keyword Value FunctionCall Keyword LeftBracket RightBracket FieldAccess PrivateIdentifier Sub Bang Tilde Mul And Div Mod Add Left Right Lt Gt Lte Gte Eq Neq OrOr AndAnd Or Xor TypeAliasDeclaration Keyword StructDeclaration Keyword StructBodyDeclaration StructMember FunctionDeclaration FunctionHeader Keyword ParamList Param ReturnType CompoundStatement Statement Keyword Keyword Keyword Keyword Keyword Keyword Keyword Keyword ContinuingStatement Keyword Keyword Keyword AddAssign SubAssign MulAssign DivAssign ModAssign AndAssign XorAssign OrAssign LeftAssign RightAssign Inc Dec Keyword Keyword Keyword ImportDeclaration Keyword ImportDeclarationList ImportDeclarationIdentifier String Keyword",
  maxTerm: 284,
  skippedNodes: [0,1],
  repeatNodeCount: 14,
  tokenData: "7k~R|X^#{pq#{qr$prs$}uv&vvw'Twx'jxy)^yz)cz{)h{|)u|}*[}!O*a!O!P/W!P!Q/`!Q!R/}!R![0i![!]0}!]!^1[!^!_1a!_!`2Q!`!a2_!b!c3O!c!}3T!}#O3f#P#Q3k#Q#R3p#R#S3T#T#U3}#U#Y3T#Y#Z4y#Z#o3T#o#p6u#p#q6z#q#r7a#r#s7f#y#z#{$f$g#{#BY#BZ#{$IS$I_#{$I|$JO#{$JT$JU#{$KV$KW#{&FU&FV#{~$QY%n~X^#{pq#{#y#z#{$f$g#{#BY#BZ#{$IS$I_#{$I|$JO#{$JT$JU#{$KV$KW#{&FU&FV#{T$uP#vP!_!`$xS$}O$US~%QVOr$}rs%gs#O$}#O#P%l#P;'S$};'S;=`&p<%lO$}~%lO%Y~~%oVOr$}rs&Us#O$}#O#P%l#P;'S$};'S;=`&p<%lO$}~&ZV%Y~Or$}rs%gs#O$}#O#P%l#P;'S$};'S;=`&p<%lO$}~&sP;=`<%l$}V&{P#{T!_!`'OQ'TO$yQ~'YQ#yTvw'`!_!`'e~'eO$W~Q'jO$zQ~'mVOw'jwx%gx#O'j#O#P(S#P;'S'j;'S;=`)W<%lO'j~(VVOw'jwx(lx#O'j#O#P(S#P;'S'j;'S;=`)W<%lO'j~(qV%Y~Ow'jwx%gx#O'j#O#P(S#P;'S'j;'S;=`)W<%lO'j~)ZP;=`<%l'j~)cO&V~~)hO&X~V)mP#xT!_!`)pQ)uO$wQV)zQ#|T{|*Q!_!`*VQ*VO%PQQ*[O$uQ~*aO%x~~*fU#uT}!O*x!O!P,`!Q!R,f!R![,{!_!`.|!`!a/RZ*}P%QQ!Q![+QX+TQ!O!P+Z!Q![+QX+`S#bX!Q![+Z!g!h+l#X#Y+l#Y#Z,ZX+oR{|+x}!O+x!Q![,OX+{P!Q![,OX,TQ#bX!Q![,O#Y#Z,ZX,`O#bXX,cP!Q![+Z~,iU!O!P+Z!Q![,{!g!h+l!z!{-[#X#Y+l#l#m-[X-OS!O!P+Z!Q![,{!g!h+l#X#Y+l~-_S!O!P-k!Q![.]!c!i.]#T#Z.]X-nR!Q![-w!c!i-w#T#Z-wX-|T#bX!Q![-w!c!i-w!r!s+l#T#Z-w#d#e+l~.bVv~!O!P-w!Q![.]!c!i.]!r!s+l#T#Z.]#d#e+l#i#j.w~.|Ow~Q/RO$vQW/WO&qW_/]P&iU!Q![+Z~/eR#zTz{/n!P!Q/s!_!`/x~/sO%p~~/xO%o~Q/}O$xQ~0SVv~!O!P+Z!Q![,{!g!h+l!z!{-[#X#Y+l#i#j.w#l#m-[~0nTv~!O!P+Z!Q![0i!g!h+l#X#Y+l#i#j.wZ1SP&ZY![!]1VP1[O'WP~1aO%r~V1hQ%tP$PS!^!_1n!_!`1{U1sP#}S!_!`1vQ1{O$}QS2QO$RSV2VP#gR!_!`2YS2_O$TSV2fQ%uP$QS!_!`2l!`!a2qS2qO$SSU2vP$OS!_!`2yQ3OO%OQ~3TO&U~X3YSSX!Q![3T!c!}3T#R#S3T#T#o3T~3kO#q~~3pO#r~V3uP$YT!_!`3xQ3}O${QZ4SUSX!Q![3T!c!}3T#R#S3T#T#g3T#g#h4f#h#o3TZ4mS'UQSX!Q![3T!c!}3T#R#S3T#T#o3TZ5OUSX!Q![3T!c!}3T#R#S3T#T#f3T#f#g5b#g#o3TZ5gUSX!Q![3T!c!}3T#R#S3T#T#c3T#c#d5y#d#o3TZ6OUSX!Q![3T!c!}3T#R#S3T#T#a3T#a#b6b#b#o3TZ6iS'VQSX!Q![3T!c!}3T#R#S3T#T#o3T~6zO&p~~7PQ$XT!_!`7V#p#q7[Q7[O$|Q~7aO$V~~7fO&o~~7kO#w~",
  tokenizers: [untilEOLToken, untilCommentCloseToken, 0, 1, 2, 3],
  topRules: {"Program":[0,2]},
  specialized: [{term: 4, get: value => spec_Identifier[value] || -1}],
  tokenPrec: 4580
})